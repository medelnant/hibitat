"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ease, freeViewport } from "./shared";

function matchFogToDistance(scene: THREE.Scene, distance: number) {
  const fog = scene.fog as THREE.FogExp2 | null;
  if (fog) fog.density = 0.55 / Math.max(distance, 1);
}

/**
 * Glides the orbit target to the focused node and frames everything currently in view:
 * `radius` is how far the farthest visible node sits from the focus. The zoom eases only
 * after the framing changes, so it never fights the user's own scroll-zoom.
 */
export function CameraRig({ target, radius }: { target: THREE.Vector3; radius: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const zooming = useRef(true);
  // scratch vectors, reused every frame instead of allocating
  const delta = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    zooming.current = true;
    invalidate();
  }, [radius, target, size, invalidate]);

  useFrame((_, dt) => {
    if (!controls) return;
    const t = ease(0.02, dt);
    delta.copy(target).sub(controls.target);
    const moving = delta.lengthSq() > 1e-6;
    if (moving) {
      delta.multiplyScalar(t);
      controls.target.add(delta);
      camera.position.add(delta);
    }

    // While the canvas has no size yet (mount, resize, hot reload) the framing maths would
    // divide 0 by 0 and poison the camera with NaN for good, so wait for a real size.
    const free = freeViewport(size.width, size.height);
    const measurable = free.width > 0 && free.height > 0;

    if (zooming.current && measurable) {
      offset.copy(camera.position).sub(controls.target);
      // fit a sphere of `radius` into whichever free-view axis is tighter
      const halfV = THREE.MathUtils.degToRad(camera.fov) / 2;
      const halfH = Math.atan(Math.tan(halfV) * (free.width / free.height));
      const goal = THREE.MathUtils.clamp(
        (radius * 1.35) / Math.sin(Math.min(halfV, halfH)),
        controls.minDistance + 0.5,
        controls.maxDistance - 0.01,
      );
      const next = THREE.MathUtils.lerp(offset.length(), goal, t * 0.8);
      camera.position.copy(controls.target).add(offset.setLength(next));
      if (Math.abs(next - goal) < 0.02) zooming.current = false;
    }

    // Keep the depth haze constant relative to the framing: near nodes clear, far ones misty,
    // whether the camera sits at 12 units or 50.
    matchFogToDistance(scene, controls.getDistance());

    if (moving || zooming.current) {
      controls.update();
      invalidate(); // keep frames coming in on-demand mode until the glide settles
    }
  });

  return null;
}

/** Shifts the projection so the focus sits centred in the area the panel leaves free. */
export function PanelViewOffset() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const { width: w, height: h } = size;
    if (w <= 0 || h <= 0) return; // a 0-sized view offset would make the projection NaN
    const free = freeViewport(w, h);
    // shift the projection so the free area's centre becomes the screen's optical centre
    camera.setViewOffset(w, h, (w - free.width) / 2, (h - free.height) / 2, w, h);
    camera.updateProjectionMatrix();
    invalidate();
    return () => camera.clearViewOffset();
  }, [camera, size, invalidate]);

  return null;
}
