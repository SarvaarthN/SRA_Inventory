import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Lowercase any value that came out of Redis.
 *
 * Upstash runs JSON.parse over every hash value it reads back, so a field
 * stored as "101" returns the number 101 and "true" returns the boolean true —
 * only values that fail to parse stay strings. TypeScript still types these
 * fields as `string`, so `value.toLowerCase()` compiles fine and then throws
 * "toLowerCase is not a function" at runtime. `?? ""` does not help: a number
 * is neither null nor undefined.
 *
 * Use this for every search/compare over a Redis-derived field.
 */
export function lc(value: unknown): string {
  return value == null ? "" : String(value).toLowerCase()
}
