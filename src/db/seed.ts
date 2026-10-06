// Loads the original nine nodes and their threads, with a fresh layout.
// Safe to re-run: existing rows are left alone.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  // Imported after env loading so the db module sees DATABASE_URL.
  const { db, schema } = await import("./index");
  const { buildHabitatGraph } = await import("../lib/graph");

  const graph = buildHabitatGraph();

  const nodeRows = graph.mapNodes((id, a) => ({
    id,
    type: a.type,
    name: a.name,
    sub: a.sub,
    story: a.story,
    color: a.color,
    kind: a.kind ?? null,
    legacy: Boolean(a.legacy),
    curatedBy: a.curatedBy ?? null,
    curatedSince: a.curatedSince ?? null,
    x: a.x,
    y: a.y,
    z: a.z,
  }));
  const edgeRows = graph.mapEdges((_k, a, source, target) => ({ source, target, label: a.label, curates: a.curates }));

  await db.insert(schema.nodes).values(nodeRows).onConflictDoNothing();
  await db.insert(schema.edges).values(edgeRows).onConflictDoNothing();

  const n = await db.$count(schema.nodes);
  const e = await db.$count(schema.edges);
  console.log(`seeded: ${n} nodes, ${e} threads in the habitat`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
