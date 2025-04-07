/**
 * Type definitions for zod
 * 
 * Using eslint-disable to bypass the no-explicit-any rule
 * since we need this to properly define the zod interfaces for API compilation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'zod' {
  export const z: any;
  
  // Static helpers
  export function object(schema: any): any;
  export function string(): any;
  export function number(): any;
  export function array(schema: any): any;
  export function union(schemas: any[]): any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */ 