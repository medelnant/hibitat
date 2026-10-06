"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { RoundedBoxGeometry } from "three-stdlib";
import type { NodeAttrs } from "@/lib/graph";
import { ease, nodeScale, OPACITY_BY_HOP, type Visibility } from "./shared";
import type { ScenePalette } from "./theme";

// One copy of each shape for every node; size and colour come from scale and materials.
// The scene module only ever loads in the browser, so creating these at import time is safe.
const GEO = {
  sphere: new THREE.SphereGeometry(1, 40, 28),
  box: new RoundedBoxGeometry(1.5, 1.5, 1.5, 5, 0.32),
  crystal: new THREE.IcosahedronGeometry(1.05, 1),
  core: new THREE.SphereGeometry(0.7, 20, 14),
  halo: new THREE.SphereGeometry(1.4, 24, 16),
  ring: new THREE.TorusGeometry(1, 0.016, 8, 96),
};

/** This node's materials, gathered once and cached on the group rather than walked every frame. */
function materialsOf(group: THREE.Group): THREE.Material[] {
  if (!group.userData.materials) {
    const list: THREE.Material[] = [];
    group.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      if (m && !Array.isArray(m)) list.push(m);
    });
    group.userData.materials = list;
  }
  return group.userData.materials as THREE.Material[];
}

// Halos and rings are decoration; keep them out of pointer hit-testing.
const noRaycast = () => null;

interface NodeProps {
  node: NodeAttrs;
  vis: Visibility;
  isFocus: boolean;
  motion: boolean;
  palette: ScenePalette;
  onFocus: (id: string) => void;
}

export function HabitatNode({ node, vis, isFocus, motion, palette, onFocus }: NodeProps) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const settled = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => new THREE.Color(node.color), [node.color]);
  const hasRing = node.legacy || isFocus;
  const targetScale = nodeScale(vis) * (hovered ? 1.12 : 1);
  const targetOpacity = vis.visible ? OPACITY_BY_HOP[Math.min(vis.hop, 3)] : 0.06;

  // Drop the cached material list when the node's meshes change (ring added or removed).
  useEffect(() => {
    if (group.current) group.current.userData.materials = undefined;
  }, [hasRing, node.type]);

  // Any target change wakes the easing back up.
  useEffect(() => {
    settled.current = false;
    invalidate();
  }, [targetScale, targetOpacity, hasRing, palette, invalidate]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  useFrame((state, dt) => {
    if (ring.current && motion) {
      ring.current.rotation.z += dt * 0.25;
      const pulse = isFocus ? 1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.04 : 1;
      ring.current.scale.setScalar((isFocus ? 1.55 : 1.3) * pulse);
    }
    if (settled.current || !group.current) return;

    const t = ease(0.004, dt);
    const s = THREE.MathUtils.lerp(group.current.scale.x, targetScale, t);
    group.current.scale.setScalar(s);
    let done = Math.abs(s - targetScale) < 0.001;

    for (const m of materialsOf(group.current)) {
      const goal = targetOpacity * ((m.userData.base as number | undefined) ?? 1);
      m.opacity = THREE.MathUtils.lerp(m.opacity, goal, t);
      if (Math.abs(m.opacity - goal) > 0.002) done = false;
    }

    if (done) {
      group.current.scale.setScalar(targetScale);
      settled.current = true;
    } else {
      invalidate();
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // a drag to orbit, not a click
    onFocus(node.id);
  };

  return (
    <group position={[node.x, node.y, node.z]}>
      <Float enabled={motion} speed={1.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <group
          ref={group}
          scale={0.001}
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          {node.type === "exhibit" && (
            <mesh geometry={GEO.sphere}>
              <meshStandardMaterial
                userData={{ base: 1 }}
                color={color}
                emissive={color}
                emissiveIntensity={(isFocus ? 0.9 : 0.55) * palette.emissive}
                roughness={0.35}
                metalness={0.05}
                transparent
                opacity={0}
              />
            </mesh>
          )}

          {node.type === "curator" && (
            <mesh geometry={GEO.box}>
              <meshStandardMaterial
                userData={{ base: 1 }}
                color={color}
                emissive={color}
                emissiveIntensity={(isFocus ? 0.45 : 0.22) * palette.emissive}
                roughness={0.5}
                transparent
                opacity={0}
              />
            </mesh>
          )}

          {node.type === "community" && (
            <>
              <mesh geometry={GEO.crystal}>
                <meshBasicMaterial userData={{ base: 0.9 }} color={color} wireframe transparent opacity={0} />
              </mesh>
              <mesh geometry={GEO.core}>
                <meshBasicMaterial userData={{ base: 0.18 }} color={color} transparent opacity={0} depthWrite={false} />
              </mesh>
            </>
          )}

          {/* soft halo that the bloom pass turns into a glow */}
          <mesh geometry={GEO.halo} raycast={noRaycast}>
            <meshBasicMaterial
              userData={{ base: (isFocus ? 0.14 : 0.05) * palette.haloStrength }}
              color={color}
              transparent
              opacity={0}
              depthWrite={false}
              blending={palette.haloBlending}
            />
          </mesh>

          {hasRing && (
            <mesh
              ref={ring}
              geometry={GEO.ring}
              raycast={noRaycast}
              rotation={[Math.PI / 2.4, 0, 0]}
              scale={isFocus ? 1.55 : 1.3}
            >
              <meshBasicMaterial
                userData={{ base: 0.85 }}
                color={node.legacy ? "#C97A72" : "#F0B77A"}
                transparent
                opacity={0}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      </Float>
    </group>
  );
}
