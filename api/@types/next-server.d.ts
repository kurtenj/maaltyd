/**
 * Type definitions for next/server
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'next/server' {
  export class NextResponse extends Response {
    static json(body: any, init?: ResponseInit): NextResponse;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */ 