"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { HabitatGraph } from "@/lib/graph";
import type { Stage } from "@/lib/habitat-data";
import type { Candidates, Direction } from "./KeyboardBridge";
import { nodeScale, vec, visibilityFor } from "./shared";

export interface LabelItem {
  key: string;
  text: string;
  position: THREE.Vector3;
  kind: "node" | "focus" | "edge";
  shown: boolean;
  /** Set when an arrow key would travel to this node. */
  hint?: Direction;
}

export function labelItems(
  graph: HabitatGraph,
  focus: string,
  stage: Stage,
  hops: Map<string, number>,
  { names, candidates }: { names: boolean; candidates: Candidates },
): LabelItem[] {
  const hintFor: Record<string, Direction> = {};
  (Object.entries(candidates) as [Direction, string][]).forEach(([dir, id]) => (hintFor[id] = dir));

  const items: LabelItem[] = [];
  graph.forEachNode((id, a) => {
    const vis = visibilityFor(hops.get(id), stage);
    const hint = hintFor[id];
    items.push({
      key: `n:${id}`,
      text: a.name,
      // sit just under the node
      position: new THREE.Vector3(a.x, a.y - (nodeScale(vis) * 1.05 + 0.4), a.z),
      kind: id === focus ? "focus" : "node",
      // Arrow targets stay labelled even when labels are turned off.
      shown: (names && vis.visible && vis.showLabel) || Boolean(hint),
      hint,
    });
  });
  graph.forEachEdge((key, attrs, s, t, sa, ta) => {
    items.push({
      key: `e:${key}`,
      text: attrs.label,
      position: vec(sa).add(vec(ta)).multiplyScalar(0.5),
      kind: "edge",
      shown: names && (s === focus || t === focus) && stage < 3,
    });
  });
  return items;
}

interface ProjectorCache {
  view: THREE.Matrix4;
  lastView: THREE.Matrix4;
  point: THREE.Vector3;
  written: string[];
  dirty: boolean;
}

const createCache = (): ProjectorCache => ({
  view: new THREE.Matrix4(),
  lastView: new THREE.Matrix4(),
  point: new THREE.Vector3(),
  written: [],
  dirty: true,
});

function markDirty(cache: ProjectorCache) {
  cache.dirty = true;
  cache.written = [];
}

/** Writes each visible label's screen position. Skips the work entirely while the camera is still. */
function projectLabels(
  root: HTMLDivElement,
  items: LabelItem[],
  camera: THREE.Camera,
  size: { width: number; height: number },
  cache: ProjectorCache,
) {
  const { view, lastView, point } = cache;
  view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  if (!cache.dirty && view.equals(lastView)) return;
  lastView.copy(view);
  cache.dirty = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const el = root.children[i] as HTMLElement | undefined;
    if (!el || !item.shown) continue;
    point.copy(item.position).applyMatrix4(view);
    const inFront = point.z < 1;
    const x = Math.round((point.x * 0.5 + 0.5) * size.width);
    const y = Math.round((-point.y * 0.5 + 0.5) * size.height);
    const next = inFront ? `translate(${x}px, ${y}px) translate(-50%, -50%)` : "hidden";
    if (cache.written[i] === next) continue;
    cache.written[i] = next;
    if (inFront) {
      el.style.transform = next;
      el.style.visibility = "visible";
    } else {
      el.style.visibility = "hidden";
    }
  }
}

/**
 * Positions the plain-DOM labels from inside the render loop. Hidden labels are skipped,
 * unchanged transforms are not rewritten, and nothing runs while the camera is still.
 */
export function LabelProjector({ items, layer }: { items: LabelItem[]; layer: React.RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const [cache] = useState(createCache);

  useEffect(() => markDirty(cache), [cache, items, size]);

  useFrame(() => {
    if (layer.current) projectLabels(layer.current, items, camera, size, cache);
  });

  return null;
}
