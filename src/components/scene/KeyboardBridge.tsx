"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { HabitatGraph } from "@/lib/graph";
import { ease } from "./shared";

export type Direction = "left" | "right" | "up" | "down";
export type Candidates = Partial<Record<Direction, string>>;

/** What the keyboard layer can ask of the 3D scene. */
export interface SceneApi {
  /** The connected node lying most in `dir` on screen, or null if nothing is that way. */
  pick(dir: Direction): string | null;
  /** Ease the camera around the focus by the given angles (radians). */
  orbit(azimuth: number, polar: number): void;
  /** Ease the camera closer (< 1) or farther (> 1) by this factor. */
  zoom(factor: number): void;
}

const DIRS: Record<Direction, [number, number]> = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
const MAX_ANGLE = Math.cos(THREE.MathUtils.degToRad(70)); // ignore anything more than 70° off the key's direction

interface Impulse {
  azimuth: number;
  polar: number;
  zoomLog: number; // log of the remaining zoom factor
}

const toScreen = (v: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }) => {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * size.width, y: (-p.y * 0.5 + 0.5) * size.height, inFront: p.z < 1 };
};

function pickDirection(graph: HabitatGraph, focus: string, dir: Direction, state: RootState): string | null {
  if (!graph.hasNode(focus)) return null;
  const { camera, size } = state;
  const f = graph.getNodeAttributes(focus);
  const origin = toScreen(new THREE.Vector3(f.x, f.y, f.z), camera, size);
  const [ux, uy] = DIRS[dir];
  let best: string | null = null;
  let bestScore = -Infinity;

  graph.forEachNeighbor(focus, (id, a) => {
    const p = toScreen(new THREE.Vector3(a.x, a.y, a.z), camera, size);
    if (!p.inFront) return;
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return; // sitting right behind the focus: no meaningful direction
    const cos = (dx * ux + dy * uy) / len;
    if (cos < MAX_ANGLE) return;
    // Mostly alignment with the key; distance only breaks near-ties.
    const score = cos * 2 - len / Math.max(size.width, size.height);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  });
  return best;
}

/** Applies a fraction of the remaining orbit/zoom each frame, so key presses glide. */
function stepImpulse(state: RootState, impulse: Impulse, dt: number, motion: boolean): boolean {
  const controls = state.controls as OrbitControlsImpl | null;
  if (!controls) return false;
  const t = motion ? ease(0.0005, dt) : 1;
  let active = false;

  if (Math.abs(impulse.azimuth) > 1e-4 || Math.abs(impulse.polar) > 1e-4) {
    const da = impulse.azimuth * t;
    const dp = impulse.polar * t;
    controls.setAzimuthalAngle(controls.getAzimuthalAngle() + da);
    controls.setPolarAngle(THREE.MathUtils.clamp(controls.getPolarAngle() + dp, 0.15, Math.PI - 0.15));
    impulse.azimuth -= da;
    impulse.polar -= dp;
    active = true;
  }

  if (Math.abs(impulse.zoomLog) > 1e-4) {
    const step = impulse.zoomLog * t;
    const offset = state.camera.position.clone().sub(controls.target);
    const next = THREE.MathUtils.clamp(offset.length() * Math.exp(step), controls.minDistance, controls.maxDistance);
    state.camera.position.copy(controls.target).add(offset.setLength(next));
    impulse.zoomLog -= step;
    active = true;
  }

  if (active) controls.update();
  return active;
}

function sameCandidates(a: Candidates, b: Candidates) {
  return a.left === b.left && a.right === b.right && a.up === b.up && a.down === b.down;
}

/**
 * Lives inside the Canvas. Publishes a SceneApi for the keyboard layer, and while the map
 * has keyboard focus keeps `onCandidates` told which node each arrow would reach (the
 * answer shifts as the habitat drifts, so it's rechecked a few times a second).
 */
export function KeyboardBridge({
  graph,
  focus,
  motion,
  hints,
  apiRef,
  onCandidates,
}: {
  graph: HabitatGraph;
  focus: string;
  motion: boolean;
  hints: boolean;
  apiRef: React.RefObject<SceneApi | null>;
  onCandidates: (c: Candidates) => void;
}) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const [impulse] = useState<Impulse>(() => ({ azimuth: 0, polar: 0, zoomLog: 0 }));
  const [scan] = useState(() => ({ last: 0, current: {} as Candidates }));

  useEffect(() => {
    apiRef.current = {
      pick: (dir) => pickDirection(graph, focus, dir, get()),
      orbit: (azimuth, polar) => {
        nudge(impulse, azimuth, polar, 0);
        invalidate();
      },
      zoom: (factor) => {
        nudge(impulse, 0, 0, Math.log(factor));
        invalidate();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, graph, focus, get, impulse, invalidate]);

  useEffect(() => {
    if (!hints) onCandidates({});
  }, [hints, onCandidates]);

  useFrame((state, dt) => {
    if (stepImpulse(state, impulse, dt, motion)) invalidate();
    if (!hints) return;
    const now = state.clock.elapsedTime;
    if (now - scan.last < 0.2) return;
    const next: Candidates = {};
    for (const dir of Object.keys(DIRS) as Direction[]) {
      const id = pickDirection(graph, focus, dir, state);
      if (id) next[dir] = id;
    }
    rememberScan(scan, now, next, onCandidates);
  });

  return null;
}

function nudge(impulse: Impulse, azimuth: number, polar: number, zoomLog: number) {
  impulse.azimuth += azimuth;
  impulse.polar += polar;
  impulse.zoomLog += zoomLog;
}

function rememberScan(scan: { last: number; current: Candidates }, now: number, next: Candidates, notify: (c: Candidates) => void) {
  scan.last = now;
  if (sameCandidates(scan.current, next)) return;
  scan.current = next;
  notify(next);
}
