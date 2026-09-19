import type { SessionPayload } from "./session";
import type { User } from "./types";

/**
 * Authorisation predicates.
 *
 * Centralised because they are security-critical and were previously copy-pasted
 * into each route handler — a copy that drifts is a privilege-escalation bug.
 *
 * The String() wrapping is not defensive noise. Upstash JSON.parses hash values
 * on read, so a field written as the string "true" comes back as the BOOLEAN
 * true while `lib/types.ts` still types it as `string`. `user.isAdmin === "true"`
 * therefore compiles and silently evaluates false, which is exactly how an admin
 * got demoted to a normal user after logging out and back in.
 */

/** Years permitted to mutate inventory. SY is read-only. */
const WRITE_YEARS = ["TY", "LY"] as const;

/** Can this session create, update or delete inventory? */
export function canWrite(session: SessionPayload | null | undefined): boolean {
  if (!session) return false;
  return (WRITE_YEARS as readonly string[]).includes(String(session.year));
}

/** Is this session an admin (user management)? */
export function isAdminSession(session: SessionPayload | null | undefined): boolean {
  if (!session) return false;
  return String(session.isAdmin) === "true";
}

/** Is this Redis user record an admin? Handles the "true" -> true coercion. */
export function isAdminUser(user: Pick<User, "isAdmin"> | null | undefined): boolean {
  if (!user) return false;
  return String(user.isAdmin) === "true";
}

/** Does any user in this list still hold admin? Drives setup-mode recovery. */
export function hasAnyAdmin(users: (Pick<User, "isAdmin"> | null)[]): boolean {
  return users.some((u) => isAdminUser(u));
}
