"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { statsStore, type SceneStats } from "@/lib/debug-store";

interface Accumulator {
  windowStart: number;
  lastFrame: number;
  frames: number;
  worst: number;
  calls: number;
  triangles: number;
}

const PUBLISH_MS = 500;

const createAccumulator = (): Accumulator => ({
  windowStart: performance.now(),
  lastFrame: performance.now(),
  frames: 0,
  worst: 0,
  calls: 0,
  triangles: 0,
});

type Meta = Pick<SceneStats, "quality" | "qualityReason" | "frameloop">;

/**
 * Runs first in every frame: banks the previous frame's renderer totals (all passes,
 * including post-processing), then resets the counters. Publishes averages twice a second.
 */
function sample(state: RootState, acc: Accumulator, meta: Meta) {
  const { gl } = state;
  const now = performance.now();
  if (acc.frames > 0 || acc.calls > 0) acc.worst = Math.max(acc.worst, now - acc.lastFrame);
  acc.lastFrame = now;
  acc.calls += gl.info.render.calls;
  acc.triangles += gl.info.render.triangles;
  acc.frames += 1;
  gl.info.reset();

  const elapsed = now - acc.windowStart;
  if (elapsed < PUBLISH_MS) return;

  const frames = Math.max(acc.frames, 1);
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  const controls = state.controls as OrbitControlsImpl | null;
  statsStore.set({
    fps: (acc.frames * 1000) / elapsed,
    frameMs: elapsed / frames,
    worstMs: acc.worst,
    drawCalls: acc.calls / frames,
    triangles: acc.triangles / frames,
    geometries: gl.info.memory.geometries,
    textures: gl.info.memory.textures,
    programs: gl.info.programs?.length ?? 0,
    dpr: gl.getPixelRatio(),
    cameraDistance: controls ? controls.getDistance() : state.camera.position.length(),
    heapMB: memory ? memory.usedJSHeapSize / 1e6 : null,
    width: state.size.width,
    height: state.size.height,
    ...meta,
  });

  acc.windowStart = now;
  acc.frames = 0;
  acc.worst = 0;
  acc.calls = 0;
  acc.triangles = 0;
}

function setAutoReset(gl: THREE.WebGLRenderer, value: boolean) {
  gl.info.autoReset = value;
}

export function StatsProbe(meta: Meta) {
  const gl = useThree((s) => s.gl);
  const [acc] = useState(createAccumulator);

  // Count across every render call in a frame, not just the last one.
  useEffect(() => {
    setAutoReset(gl, false);
    return () => setAutoReset(gl, true);
  }, [gl]);

  useFrame((state) => sample(state, acc, meta), -1000);

  return null;
}
