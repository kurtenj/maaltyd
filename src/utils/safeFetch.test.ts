// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  assertPublicUrl,
  isBlockedIp,
  safeFetchText,
  UnsafeUrlError,
  ResponseTooLargeError,
  HttpStatusError,
} from './safeFetch';

const publicResolver = vi.fn(async () => ['93.184.216.34']);

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', 'fc00::1', 'ff02::1', '::ffff:127.0.0.1',
    '::ffff:7f00:1', '64:ff9b::a00:1', 'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8'])('allows %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  it('accepts a public https URL', async () => {
    const url = await assertPublicUrl('https://example.com/recipe', publicResolver);
    expect(url.hostname).toBe('example.com');
  });

  it.each([
    ['ftp://example.com/', 'non-http protocol'],
    ['http://localhost/', 'localhost'],
    ['http://127.0.0.1/', 'loopback literal'],
    ['http://[::1]/', 'IPv6 loopback literal'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['http://example.com:8080/', 'custom port'],
    ['http://user:pass@example.com/', 'credentials'],
    ['not a url', 'invalid URL'],
  ])('rejects %s (%s)', async (url) => {
    await expect(assertPublicUrl(url, publicResolver)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('rejects hostnames that resolve to a private address', async () => {
    const resolver = async () => ['93.184.216.34', '10.0.0.5'];
    await expect(assertPublicUrl('https://sneaky.example/', resolver)).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

describe('safeFetchText', () => {
  it('returns the body of a successful response', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>ok</html>', { status: 200 }));
    await expect(
      safeFetchText('https://example.com/', { resolve: publicResolver, fetchImpl })
    ).resolves.toBe('<html>ok</html>');
  });

  it('re-validates redirect targets and refuses redirects to internal addresses', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
    );
    await expect(
      safeFetchText('https://example.com/', { resolve: publicResolver, fetchImpl })
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows safe redirects', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/final' } }))
      .mockResolvedValueOnce(new Response('final page', { status: 200 }));
    await expect(
      safeFetchText('https://example.com/start', { resolve: publicResolver, fetchImpl })
    ).resolves.toBe('final page');
    expect(String(fetchImpl.mock.calls[1][0])).toBe('https://example.com/final');
  });

  it('gives up after too many redirects', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: '/again' } }));
    await expect(
      safeFetchText('https://example.com/', { resolve: publicResolver, fetchImpl, maxRedirects: 2 })
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('throws HttpStatusError for non-2xx responses', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 403 }));
    await expect(
      safeFetchText('https://example.com/', { resolve: publicResolver, fetchImpl })
    ).rejects.toMatchObject({ name: 'HttpStatusError', status: 403 } satisfies Partial<HttpStatusError>);
  });

  it('enforces the size limit while streaming', async () => {
    const fetchImpl = vi.fn(async () => new Response('x'.repeat(2000), { status: 200 }));
    await expect(
      safeFetchText('https://example.com/', { resolve: publicResolver, fetchImpl, maxBytes: 1000 })
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it('rejects early when content-length exceeds the limit', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('small', { status: 200, headers: { 'content-length': '999999' } })
    );
    await expect(
      safeFetchText('https://example.com/', { resolve: publicResolver, fetchImpl, maxBytes: 1000 })
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });
});
