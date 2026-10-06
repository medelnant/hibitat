import Graph from "graphology";
import type { SerializedGraph } from "graphology-types";
import { EDGES, NODES, type HabitatNode } from "./habitat-data";

export interface NodeAttrs extends HabitatNode {
  x: number;
  y: number;
  z: number;
}

export interface EdgeAttrs {
  label: string;
  curates: boolean;
}

export type HabitatGraph = Graph<NodeAttrs, EdgeAttrs>;
export type SerializedHabitat = SerializedGraph<NodeAttrs, EdgeAttrs>;

// Small seeded PRNG so the layout is identical on every load.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EDGE_LENGTH = 2.8;
const GRAVITY = 0.03;

// Fruchterman–Reingold layout in 3D, written against graphology's attribute API.
// FR's quadratic attraction keeps leaf nodes from drifting far out on long tails.
function layout3d(graph: HabitatGraph, iterations = 700, edgeLength = EDGE_LENGTH, gravity = GRAVITY) {
  const rand = mulberry32(7);
  graph.forEachNode((id) => {
    graph.mergeNodeAttributes(id, {
      x: (rand() - 0.5) * 6,
      y: (rand() - 0.5) * 6,
      z: (rand() - 0.5) * 6,
    });
  });

  const ids = graph.nodes();
  const k2 = edgeLength * edgeLength;

  for (let step = 0; step < iterations; step++) {
    const cooling = 1 - step / iterations;
    const force: Record<string, [number, number, number]> = {};
    ids.forEach((id) => (force[id] = [0, 0, 0]));

    for (let i = 0; i < ids.length; i++) {
      const a = graph.getNodeAttributes(ids[i]);
      for (let j = i + 1; j < ids.length; j++) {
        const b = graph.getNodeAttributes(ids[j]);
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d2 = Math.max(dx * dx + dy * dy + dz * dz, 0.01);
        const f = k2 / d2;
        force[ids[i]][0] += dx * f; force[ids[i]][1] += dy * f; force[ids[i]][2] += dz * f;
        force[ids[j]][0] -= dx * f; force[ids[j]][1] -= dy * f; force[ids[j]][2] -= dz * f;
      }
    }

    graph.forEachEdge((_e, _attrs, s, t, sa, ta) => {
      const dx = ta.x - sa.x, dy = ta.y - sa.y, dz = ta.z - sa.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const f = (d * d) / edgeLength;
      force[s][0] += (dx / d) * f; force[s][1] += (dy / d) * f; force[s][2] += (dz / d) * f;
      force[t][0] -= (dx / d) * f; force[t][1] -= (dy / d) * f; force[t][2] -= (dz / d) * f;
    });

    ids.forEach((id) => {
      const p = graph.getNodeAttributes(id);
      const [fx, fy, fz] = force[id];
      // gentle pull to the origin, then a capped step
      const gx = fx - p.x * gravity, gy = fy - p.y * gravity, gz = fz - p.z * gravity;
      const len = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      const stepSize = Math.min(len, 0.35 * cooling + 0.01);
      graph.mergeNodeAttributes(id, {
        x: p.x + (gx / len) * stepSize,
        y: p.y + (gy / len) * stepSize,
        z: p.z + (gz / len) * stepSize,
      });
    });
  }
}

/**
 * Places one newly added node next to `anchor` and settles it with the same forces as
 * layout3d, moving only the new node. Everyone already on the map stays exactly put.
 */
export function placeNewNode(graph: HabitatGraph, id: string, anchor: string, iterations = 240) {
  const a = graph.getNodeAttributes(anchor);
  // start a link's length away from the anchor, in a random direction
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  graph.mergeNodeAttributes(id, {
    x: a.x + EDGE_LENGTH * r * Math.cos(theta),
    y: a.y + EDGE_LENGTH * r * Math.sin(theta),
    z: a.z + EDGE_LENGTH * u,
  });

  const k2 = EDGE_LENGTH * EDGE_LENGTH;
  for (let step = 0; step < iterations; step++) {
    const cooling = 1 - step / iterations;
    const p = graph.getNodeAttributes(id);
    let fx = -p.x * GRAVITY, fy = -p.y * GRAVITY, fz = -p.z * GRAVITY;

    graph.forEachNode((other, o) => {
      if (other === id) return;
      const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
      const f = k2 / Math.max(dx * dx + dy * dy + dz * dz, 0.01);
      fx += dx * f; fy += dy * f; fz += dz * f;
    });

    graph.forEachNeighbor(id, (_nb, o) => {
      const dx = o.x - p.x, dy = o.y - p.y, dz = o.z - p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const f = (d * d) / EDGE_LENGTH;
      fx += (dx / d) * f; fy += (dy / d) * f; fz += (dz / d) * f;
    });

    const len = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    const stepSize = Math.min(len, 0.3 * cooling + 0.01);
    graph.mergeNodeAttributes(id, {
      x: p.x + (fx / len) * stepSize,
      y: p.y + (fy / len) * stepSize,
      z: p.z + (fz / len) * stepSize,
    });
  }
  return graph.getNodeAttributes(id);
}

/** The original nine nodes with a fresh layout. Used once, to seed the database. */
export function buildHabitatGraph(): HabitatGraph {
  const graph: HabitatGraph = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
  NODES.forEach((n) => graph.addNode(n.id, { ...n, x: 0, y: 0, z: 0 }));
  EDGES.forEach((e) =>
    graph.addEdge(e.source, e.target, { label: e.label, curates: Boolean(e.curates) }),
  );
  layout3d(graph);
  return graph;
}

/** Rebuilds the graph in the browser from the precomputed layout; no layout work client-side. */
export function hydrateHabitat(data: SerializedHabitat): HabitatGraph {
  return Graph.from<NodeAttrs, EdgeAttrs>(data);
}

/** Breadth-first hop count from `focus` to every reachable node. */
export function hopDistances(graph: HabitatGraph, focus: string): Map<string, number> {
  const dist = new Map<string, number>([[focus, 0]]);
  const queue = [focus];
  while (queue.length) {
    const id = queue.shift()!;
    const d = dist.get(id)!;
    graph.forEachNeighbor(id, (nb) => {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    });
  }
  return dist;
}

export interface Thread {
  id: string;
  label: string;
}

/** Direct connections of a node, with the relationship label. */
export function threadsFrom(graph: HabitatGraph, id: string): Thread[] {
  const out: Thread[] = [];
  graph.forEachEdge(id, (_e, attrs, s, t) => {
    out.push({ id: s === id ? t : s, label: attrs.label });
  });
  return out;
}
