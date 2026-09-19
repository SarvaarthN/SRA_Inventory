import { lc } from "./utils";
import { getCategoryLabel } from "./types";
import type { Box, Component } from "./types";

/**
 * Free-text search over components and boxes.
 *
 * This lives here rather than inline in each component for two reasons:
 *
 * 1. Every field below comes out of Redis, and Upstash JSON.parses hash values
 *    on read — a location stored as "101" returns the number 101, "true"
 *    returns a boolean. Calling .toLowerCase() on those throws at runtime even
 *    though TypeScript types them as string. Funnelling every field through
 *    lc() in one place means that can only ever be got wrong once.
 *
 * 2. Filter logic inline in a React component can only be tested by rendering.
 *    As pure functions these are covered directly by test/unit/search.test.ts.
 *
 * Fields are joined with a NUL separator so a match can never straddle two
 * fields (e.g. name ending "AB" + id starting "CD" must not match "ABCD").
 */
const SEP = "\u0000";

/** Everything about a component that free-text search should look at. */
export function componentHaystack(
  component: Component,
  boxLocations: Record<string, string> = {}
): string {
  return [
    component.name,
    component.id,
    component.description,
    component.boxName,
    boxLocations[String(component.boxId ?? "")],
    component.category,
    getCategoryLabel(component),
  ]
    .map(lc)
    .join(SEP);
}

/** Everything about a box that free-text search should look at. */
export function boxHaystack(box: Box): string {
  return [box.name, box.id, box.location].map(lc).join(SEP);
}

/** An empty or whitespace-only query matches everything. */
export function componentMatches(
  component: Component,
  query: string,
  boxLocations: Record<string, string> = {}
): boolean {
  const q = lc(query).trim();
  if (!q) return true;
  return componentHaystack(component, boxLocations).includes(q);
}

/** An empty or whitespace-only query matches everything. */
export function boxMatches(box: Box, query: string): boolean {
  const q = lc(query).trim();
  if (!q) return true;
  return boxHaystack(box).includes(q);
}

export function filterComponents(
  components: Component[],
  query: string,
  boxLocations: Record<string, string> = {}
): Component[] {
  const q = lc(query).trim();
  if (!q) return components;
  return components.filter((c) => componentHaystack(c, boxLocations).includes(q));
}

export function filterBoxes(boxes: Box[], query: string): Box[] {
  const q = lc(query).trim();
  if (!q) return boxes;
  return boxes.filter((b) => boxHaystack(b).includes(q));
}

/** Category filter used alongside free-text search on the components page. */
export const ALL_CATEGORIES = "ALL";

export function matchesCategory(component: Component, selected: string): boolean {
  return selected === ALL_CATEGORIES || lc(component.category) === lc(selected);
}
