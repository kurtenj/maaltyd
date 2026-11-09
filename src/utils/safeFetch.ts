import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Server-side fetch for user-supplied URLs (SSRF protection).
 *
 * - Only http(s), only default ports
 * - Every hostname is DNS-resolved and rejected if *any* address is private,
 *   loopback, link-local, or otherwise non-public
 * - Redirects are followed manually so each hop is re-validated
 * - The response body is capped at `maxBytes`
 *
 * Residual risk: DNS rebinding between our lookup and fetch's own lookup.
 * Acceptable here because the endpoint requires auth and is rate-limited.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export class ResponseTooLargeError extends Error {
  constructor() {
    super('Response body exceeded the size limit');
    this.name = 'ResponseTooLargeError';
  }
}

export class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Upstream responded with status ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const BLOCKED_IPV4_CIDRS: [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (cloud metadata endpoints)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

function isBlockedIPv4(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  return BLOCKED_IPV4_CIDRS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (addr & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');

  // IPv4-mapped / -compatible forms: ::ffff:a.b.c.d, ::a.b.c.d
  const embeddedV4 = lower.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embeddedV4) return isBlockedIPv4(embeddedV4[1]);
  // Hex-form IPv4-mapped (e.g. ::ffff:7f00:1) — just block the whole mapped range
  if (lower.startsWith('::ffff:')) return true;

  if (lower === '::' || lower === '::1') return true; // unspecified, loopback
  const firstHextet = parseInt(lower.split(':')[0] || '0', 16);
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (lower.startsWith('64:ff9b:')) return true; // NAT64 (can reach internal v4)
  if (lower.startsWith('2001:db8:')) return true; // documentation
  return false;
}

/** True if the IP literal is not a publicly routable address. */
export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip.replace(/^\[|\]$/g, ''));
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true; // not an IP at all — refuse
}

type Resolver = (hostname: string) => Promise<string[]>;

const defaultResolver: Resolver = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => r.address);
};

/** Throws UnsafeUrlError unless the URL is http(s) on a default port and resolves only to public IPs. */
export async function assertPublicUrl(rawUrl: string | URL, resolve: Resolver = defaultResolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https URLs are allowed');
  }
  if (url.port !== '') {
    throw new UnsafeUrlError('Custom ports are not allowed');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with credentials are not allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    throw new UnsafeUrlError('Internal hostnames are not allowed');
  }

  const addresses = isIP(hostname) ? [hostname] : await resolve(hostname).catch(() => {
    throw new UnsafeUrlError('Could not resolve hostname');
  });
  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    throw new UnsafeUrlError('URL resolves to a non-public address');
  }

  return url;
}

async function readBodyWithLimit(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel();
    throw new ResponseTooLargeError();
  }
  if (!res.body) return '';

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ResponseTooLargeError();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Injectable for tests */
  resolve?: Resolver;
  fetchImpl?: typeof fetch;
}

/** GET a user-supplied URL safely and return the body as text. */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<string> {
  const {
    headers,
    timeoutMs = 10_000,
    maxBytes = 3 * 1024 * 1024,
    maxRedirects = 5,
    resolve = defaultResolver,
    fetchImpl = fetch,
  } = options;

  const signal = AbortSignal.timeout(timeoutMs);
  let url = await assertPublicUrl(rawUrl, resolve);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetchImpl(url, { headers, signal, redirect: 'manual' });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel();
      if (!location) throw new HttpStatusError(res.status);
      url = await assertPublicUrl(new URL(location, url), resolve);
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel();
      throw new HttpStatusError(res.status);
    }

    return readBodyWithLimit(res, maxBytes);
  }

  throw new UnsafeUrlError('Too many redirects');
}
