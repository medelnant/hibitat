import type { HabitatNode } from "./habitat-data";

/** "Exhibit · held in memory", "Exhibit · place", "Curator", … */
export function typeLabel(t: Pick<HabitatNode, "type" | "legacy" | "kind">) {
  if (t.type === "curator") return "Curator";
  if (t.type === "community") return "Community";
  if (t.legacy) return "Exhibit · held in memory";
  return t.kind ? `Exhibit · ${t.kind}` : "Exhibit";
}

/** Where a node lives as a page: exhibits have their own; everyone else is seen on the map. */
export function nodeHref(node: Pick<HabitatNode, "id" | "type">) {
  return node.type === "exhibit" ? `/exhibit/${node.id}` : `/?focus=${node.id}`;
}
