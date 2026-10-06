"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/db";
import { placeNewNode } from "@/lib/graph";
import { graphFromRows } from "@/lib/habitat-repo";

/*
 * Writes are open to anyone while HIBITAT is a prototype. Server actions are plain POST
 * endpoints, so every input is validated here, a hidden honeypot field catches naive bots,
 * and each address gets a small write budget. Add accounts before any public URL.
 */

export type ActionResult = { ok: true; focus: string } | { ok: false; error: string };

const EXHIBIT_COLORS = ["#E0954B", "#8FB3BF", "#C97A72", "#7C9CA6", "#C8654C", "#A8957C", "#B79BC4", "#9DBF8A"];
const TYPE_COLORS = { curator: "#F3E4CC", community: "#A9C4AC" } as const;

const label = z
  .string()
  .trim()
  .min(1, "Name the relationship.")
  .max(40, "Keep the relationship under 40 characters.");
const id = z.string().trim().min(1).max(80);
// Must stay empty: real people never see this field.
const honeypot = z.string().max(0, "Something went wrong. Please try again.").optional().default("");

const addThreadInput = z.object({ from: id, to: id, label, website: honeypot });

const newNodeInput = z.object({
  type: z.enum(["exhibit", "curator", "community"]),
  kind: z.enum(["animal", "place", "thing"]).optional(),
  name: z.string().trim().min(1, "Give them a name.").max(60, "Keep the name under 60 characters."),
  sub: z.string().trim().max(120, "Keep the short description under 120 characters.").optional().default(""),
  story: z.string().trim().max(1200, "Keep the story under 1,200 characters.").optional().default(""),
});
const createAndLinkInput = z.object({ from: id, node: newNodeInput, label, website: honeypot });

/* ---------- write budget: 12 writes per 10 minutes per address (per server process) ---------- */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_WRITES = 12;
const writes = new Map<string, number[]>();

async function overBudget(): Promise<boolean> {
  const h = await headers();
  // nginx overwrites X-Real-IP with the connecting address; X-Forwarded-For's first entry is client-supplied.
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
  const now = Date.now();
  const recent = (writes.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_WRITES) {
    writes.set(ip, recent);
    return true;
  }
  recent.push(now);
  writes.set(ip, recent);
  return false;
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Please check the form and try again.";

function slugify(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "node";
}

function revalidateHabitat(...ids: string[]) {
  revalidatePath("/");
  for (const nodeId of ids) revalidatePath(`/exhibit/${nodeId}`);
}

/* ---------- actions ---------- */

/** Connects two nodes that are already in the habitat. */
export async function addThread(input: unknown): Promise<ActionResult> {
  const parsed = addThreadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { from, to, label: name } = parsed.data;
  if (from === to) return { ok: false, error: "A thread needs two different ends." };
  if (await overBudget()) return { ok: false, error: "That’s a lot of threads at once. Please wait a few minutes." };

  const found = await db
    .select({ id: schema.nodes.id })
    .from(schema.nodes)
    .where(or(eq(schema.nodes.id, from), eq(schema.nodes.id, to)));
  if (found.length !== 2) return { ok: false, error: "One of those is no longer in the habitat." };

  const existing = await db
    .select({ id: schema.edges.id })
    .from(schema.edges)
    .where(
      or(
        and(eq(schema.edges.source, from), eq(schema.edges.target, to)),
        and(eq(schema.edges.source, to), eq(schema.edges.target, from)),
      ),
    );
  if (existing.length) return { ok: false, error: "Those two are already connected." };

  await db.insert(schema.edges).values({ source: from, target: to, label: name, curates: name.toLowerCase() === "curates" });
  revalidateHabitat(from, to);
  return { ok: true, focus: to };
}

/** Adds someone or something new and connects it to `from`. */
export async function createAndLink(input: unknown): Promise<ActionResult> {
  const parsed = createAndLinkInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { from, node, label: name } = parsed.data;
  if (await overBudget()) return { ok: false, error: "That’s a lot of new additions at once. Please wait a few minutes." };

  try {
    return await db.transaction(async (tx) => {
    const [nodeRows, edgeRows] = await Promise.all([tx.select().from(schema.nodes), tx.select().from(schema.edges)]);
    const graph = graphFromRows(nodeRows, edgeRows);
    if (!graph.hasNode(from)) return { ok: false as const, error: "That node is no longer in the habitat." };

    // A readable, unique id: "luna", then "luna-2", …
    const base = slugify(node.name);
    let newId = base;
    for (let n = 2; graph.hasNode(newId); n++) newId = `${base}-${n}`;

    const color =
      node.type === "exhibit"
        ? EXHIBIT_COLORS[[...newId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % EXHIBIT_COLORS.length]
        : TYPE_COLORS[node.type];
    const kind = node.type === "exhibit" && (node.kind === "place" || node.kind === "thing") ? node.kind : undefined;

    // Lay out just the newcomer beside the node it was added from.
    graph.addNode(newId, { id: newId, type: node.type, name: node.name, sub: node.sub, story: node.story, color, kind, x: 0, y: 0, z: 0 });
    graph.addEdge(from, newId, { label: name, curates: name.toLowerCase() === "curates" });
    const pos = placeNewNode(graph, newId, from);

    await tx.insert(schema.nodes).values({
      id: newId,
      type: node.type,
      name: node.name,
      sub: node.sub,
      story: node.story,
      color,
      kind: kind ?? null,
      x: pos.x,
      y: pos.y,
      z: pos.z,
    });
    await tx.insert(schema.edges).values({ source: from, target: newId, label: name, curates: name.toLowerCase() === "curates" });

    revalidateHabitat(from, newId);
    return { ok: true as const, focus: newId };
    });
  } catch (err) {
    // e.g. someone else added the same name in the same instant; the transaction rolled back
    console.error("createAndLink failed", err);
    return { ok: false, error: "Couldn’t add that just now. Please try again." };
  }
}
