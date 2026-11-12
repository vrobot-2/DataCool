/**
 * Minimal ambient types for `bun:test` so `tsc --noEmit` (part of `bun run build`)
 * accepts calc.test.ts without adding bun-types as a dependency.
 */
declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export const it: typeof test;
  export interface Matchers {
    toBe(v: unknown): void;
    toEqual(v: unknown): void;
    toBeCloseTo(v: number, digits?: number): void;
    toBeGreaterThan(v: number): void;
    toBeLessThan(v: number): void;
    toBeGreaterThanOrEqual(v: number): void;
    toBeLessThanOrEqual(v: number): void;
    toHaveLength(n: number): void;
    toContain(v: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    not: Matchers;
  }
  export function expect(v: unknown): Matchers;
}
