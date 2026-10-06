import * as THREE from "three";
import type { NodeAttrs } from "@/lib/graph";
import type { Stage } from "@/lib/habitat-data";

export const SIZE_BY_HOP = [0.62, 0.44, 0.33, 0.26];
export const OPACITY_BY_HOP = [1, 1, 0.72, 0.5];

export interface Visibility {
  hop: number;
  visible: boolean;
  showLabel: boolean;
}

export function visibilityFor(hop: number | undefined, stage: Stage): Visibility {
  const h = hop ?? Infinity;
  const maxHop = stage === 3 ? Infinity : stage;
  return { hop: h, visible: h <= maxHop, showLabel: h <= (stage === 3 ? 1 : 2) };
}

export function nodeScale(vis: Visibility) {
  return vis.visible ? (SIZE_BY_HOP[Math.min(vis.hop, 3)] ?? SIZE_BY_HOP[3]) : 0.2;
}

export const vec = (a: NodeAttrs) => new THREE.Vector3(a.x, a.y, a.z);

/** Frame-rate independent easing factor: fraction of the gap to close this frame. */
export const ease = (rate: number, dt: number) => 1 - Math.pow(rate, dt);

/**
 * The part of the screen the scene really has to itself. Desktop: everything left of the
 * 400px panel (plus its 16px inset). Narrow: the area above the bottom sheet (~46vh).
 */
export function freeViewport(width: number, height: number) {
  return width > 900
    ? { width: width - 416, height }
    : { width, height: height * 0.54 };
}
