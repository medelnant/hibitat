"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from "three-stdlib";
import type { HabitatGraph } from "@/lib/graph";
import type { Stage } from "@/lib/habitat-data";
import { ease, visibilityFor } from "./shared";
import type { ScenePalette } from "./theme";

/** Eases segment colours toward their targets and uploads them. Returns true once settled. */
function stepColors(current: Float32Array, target: Float32Array, buffer: THREE.InterleavedBuffer, t: number) {
  let done = true;
  for (let i = 0; i < current.length; i++) {
    current[i] += (target[i] - current[i]) * t;
    if (Math.abs(target[i] - current[i]) > 0.002) done = false;
  }
  if (done) current.set(target);
  (buffer.array as Float32Array).set(current);
  buffer.needsUpdate = true;
  return done;
}

interface EdgeRef {
  source: string;
  target: string;
}

/**
 * All threads of one style in a single draw call. A thread fades by easing its colour
 * toward the sky colour (dark or paper), so there is no per-line opacity and no
 * per-line draw call, and it works the same in both themes.
 */
function EdgeBatch({
  graph,
  edges,
  dashed,
  focus,
  stage,
  hops,
  palette,
}: {
  graph: HabitatGraph;
  edges: EdgeRef[];
  dashed: boolean;
  focus: string;
  stage: Stage;
  hops: Map<string, number>;
  palette: ScenePalette;
}) {
  // Threads first appear out of whatever the sky was at mount, then follow theme changes.
  const [initialSky] = useState(() => new THREE.Color(palette.bg));
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const settled = useRef(false);

  const { line, colorBuffer, current } = useMemo(() => {
    const positions = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => {
      const a = graph.getNodeAttributes(e.source);
      const b = graph.getNodeAttributes(e.target);
      positions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    });
    const current = new Float32Array(edges.length * 6); // start as sky, fade in
    for (let i = 0; i < edges.length * 2; i++) current.set([initialSky.r, initialSky.g, initialSky.b], i * 3);

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    geometry.setColors(current);

    const material = new LineMaterial({
      vertexColors: true,
      linewidth: 1.4,
      transparent: true,
      depthWrite: false,
      dashed,
      dashSize: 0.18,
      gapSize: 0.16,
    });

    const line = new LineSegments2(geometry, material);
    line.raycast = () => {};
    if (dashed) line.computeLineDistances();

    const colorAttr = geometry.attributes.instanceColorStart as THREE.InterleavedBufferAttribute;
    return { line, colorBuffer: colorAttr.data, current };
  }, [graph, edges, dashed, initialSky]);

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      line.material.dispose();
    };
  }, [line]);

  useEffect(() => {
    line.material.resolution.set(size.width, size.height);
    invalidate();
  }, [line, size, invalidate]);

  // Target colour per segment for the current focus and stage.
  const target = useMemo(() => {
    const out = new Float32Array(edges.length * 6);
    const sky = new THREE.Color(palette.bg);
    const focusInk = new THREE.Color(palette.edgeFocus);
    const baseInk = new THREE.Color(palette.edgeBase);
    const c = new THREE.Color();
    edges.forEach((e, i) => {
      const first = e.source === focus || e.target === focus;
      const visible = visibilityFor(hops.get(e.source), stage).visible && visibilityFor(hops.get(e.target), stage).visible;
      const strength = first ? 0.75 : visible ? (stage === 3 ? 0.26 : 0.2) : 0.03;
      c.copy(sky).lerp(first ? focusInk : baseInk, strength);
      out.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    });
    return out;
  }, [edges, focus, stage, hops, palette]);

  useEffect(() => {
    settled.current = false;
    invalidate();
  }, [target, invalidate]);

  useFrame((_, dt) => {
    if (settled.current) return;
    if (stepColors(current, target, colorBuffer, ease(0.004, dt))) settled.current = true;
    else invalidate();
  });

  return <primitive object={line} />;
}

export function Edges({
  graph,
  focus,
  stage,
  hops,
  palette,
}: {
  graph: HabitatGraph;
  focus: string;
  stage: Stage;
  hops: Map<string, number>;
  palette: ScenePalette;
}) {
  const { solid, dashed } = useMemo(() => {
    const solid: EdgeRef[] = [];
    const dashed: EdgeRef[] = [];
    graph.forEachEdge((_k, attrs, source, target) => {
      (attrs.curates ? dashed : solid).push({ source, target });
    });
    return { solid, dashed };
  }, [graph]);

  return (
    <>
      <EdgeBatch graph={graph} edges={solid} dashed={false} focus={focus} stage={stage} hops={hops} palette={palette} />
      <EdgeBatch graph={graph} edges={dashed} dashed focus={focus} stage={stage} hops={hops} palette={palette} />
    </>
  );
}
