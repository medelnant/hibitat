// Server-only data access: imported by pages and server actions, never by client components.
import Graph from "graphology";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { EdgeRow, NodeRow } from "@/db/schema";
import type { EdgeAttrs, HabitatGraph, NodeAttrs, SerializedHabitat } from "./graph";

export function rowToNode(row: NodeRow): NodeAttrs {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    sub: row.sub,
    story: row.story,
    color: row.color,
    kind: row.kind ?? undefined,
    legacy: row.legacy || undefined,
    curatedBy: row.curatedBy ?? undefined,
    curatedSince: row.curatedSince ?? undefined,
    x: row.x,
    y: row.y,
    z: row.z,
  };
}

export function graphFromRows(nodeRows: NodeRow[], edgeRows: EdgeRow[]): HabitatGraph {
  const graph: HabitatGraph = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
  nodeRows.forEach((row) => graph.addNode(row.id, rowToNode(row)));
  edgeRows.forEach((e) => {
    if (graph.hasNode(e.source) && graph.hasNode(e.target) && !graph.hasEdge(e.source, e.target)) {
      graph.addEdge(e.source, e.target, { label: e.label, curates: e.curates });
    }
  });
  return graph;
}

export async function loadHabitatGraph(): Promise<HabitatGraph> {
  const [nodeRows, edgeRows] = await Promise.all([
    db.select().from(schema.nodes).orderBy(asc(schema.nodes.createdAt), asc(schema.nodes.id)),
    db.select().from(schema.edges).orderBy(asc(schema.edges.id)),
  ]);
  return graphFromRows(nodeRows, edgeRows);
}

export async function loadSerializedHabitat(): Promise<SerializedHabitat> {
  return (await loadHabitatGraph()).export();
}

export async function listExhibitIds(): Promise<string[]> {
  const rows = await db.select({ id: schema.nodes.id }).from(schema.nodes).where(eq(schema.nodes.type, "exhibit"));
  return rows.map((r) => r.id);
}
