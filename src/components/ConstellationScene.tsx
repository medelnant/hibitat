"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor, Sparkles, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { hopDistances, type HabitatGraph } from "@/lib/graph";
import type { Stage } from "@/lib/habitat-data";
import type { QualityPref } from "@/lib/preferences-core";
import { CameraRig, PanelViewOffset } from "./scene/CameraRig";
import { Edges } from "./scene/Edges";
import { KeyboardBridge, type Candidates, type SceneApi } from "./scene/KeyboardBridge";
import { LabelProjector, labelItems } from "./scene/Labels";
import { HabitatNode } from "./scene/Nodes";
import { nodeScale, vec, visibilityFor } from "./scene/shared";
import { StatsProbe } from "./scene/StatsProbe";
import { SCENE_PALETTES } from "./scene/theme";
import styles from "./habitat.module.css";

/** Preferences after resolving "system" choices against the OS. */
export interface SceneSettings {
  theme: "dark" | "light";
  motion: boolean;
  quality: QualityPref;
  labels: boolean;
  autoRotate: boolean;
  debug: boolean;
}

interface SceneProps {
  graph: HabitatGraph;
  focus: string;
  stage: Stage;
  settings: SceneSettings;
  /** True while the map region has keyboard focus: show where each arrow key leads. */
  keyboardHints: boolean;
  apiRef: React.RefObject<SceneApi | null>;
  onFocus: (id: string) => void;
}

const HINT_ARROWS = { left: "←", right: "→", up: "↑", down: "↓" } as const;

export default function ConstellationScene({ graph, focus, stage, settings, keyboardHints, apiRef, onFocus }: SceneProps) {
  const { motion } = settings;
  const palette = SCENE_PALETTES[settings.theme];

  // Quality: a preference of high/low wins; `?quality=low` forces low for testing;
  // otherwise the performance monitor drops to 1x pixels and no post-processing when a
  // device can't hold its frame rate.
  const [urlLow] = useState(() => new URLSearchParams(window.location.search).get("quality") === "low");
  const [autoLow, setAutoLow] = useState(false);
  const qualityReason = urlLow ? "url" : settings.quality === "auto" ? "auto" : "preference";
  const lowPower = urlLow || settings.quality === "low" || (settings.quality === "auto" && autoLow);

  const hops = useMemo(() => hopDistances(graph, focus), [graph, focus]);
  const focusAttrs = graph.getNodeAttributes(focus);
  const target = useMemo(() => vec(focusAttrs), [focusAttrs]);
  // How far the farthest node in view sits from the focus (plus its glow), for camera framing.
  const radius = useMemo(() => {
    let r = 2;
    graph.forEachNode((id, a) => {
      const vis = visibilityFor(hops.get(id), stage);
      if (!vis.visible) return;
      const d = Math.hypot(a.x - target.x, a.y - target.y, a.z - target.z);
      r = Math.max(r, d + nodeScale(vis) * 1.4);
    });
    return r;
  }, [graph, hops, stage, target]);
  const [candidates, setCandidates] = useState<Candidates>({});
  const labels = useMemo(
    () => labelItems(graph, focus, stage, hops, { names: settings.labels, candidates: keyboardHints ? candidates : {} }),
    [graph, focus, stage, hops, settings.labels, candidates, keyboardHints],
  );
  const labelLayer = useRef<HTMLDivElement>(null);
  const frameloop = motion ? "always" : "demand";

  return (
    <div className={styles.canvas}>
      <Canvas
        // With reduced motion nothing animates on its own, so only render when something changes.
        frameloop={frameloop}
        dpr={lowPower ? 1 : [1, 2]}
        camera={{ position: [target.x + 3, target.y + 4, target.z + 16], fov: 40 }}
        // The effect composer renders into its own target, so canvas-level MSAA would be wasted work.
        gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }}
        onCreated={({ gl, camera }) => {
          // dev-only handles for measuring and debugging from the console
          if (process.env.NODE_ENV !== "production") {
            Object.assign(window, { __habitatGl: gl, __habitatCamera: camera });
          }
        }}
      >
        {settings.quality === "auto" && !urlLow && (
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setAutoLow(true)}
            onIncline={() => setAutoLow(false)}
            onFallback={() => setAutoLow(true)}
          />
        )}
        {settings.debug && (
          <StatsProbe quality={lowPower ? "low" : "high"} qualityReason={qualityReason} frameloop={frameloop} />
        )}

        <color attach="background" args={[palette.bg]} />
        <fogExp2 attach="fog" args={[palette.bg, 0.032]} />

        <ambientLight intensity={palette.ambient} />
        <pointLight position={[6, 8, 6]} intensity={60} color="#F0B77A" />
        <pointLight position={[-8, -4, -6]} intensity={40} color="#7C9CA6" />

        {palette.stars && (
          <Stars radius={70} depth={40} count={lowPower ? 1200 : 2600} factor={3} saturation={0} fade speed={motion ? 0.4 : 0} />
        )}
        <Sparkles count={lowPower ? 40 : 90} scale={16} size={2.2} speed={motion ? 0.25 : 0} opacity={0.55} color={palette.sparkleWarm} />
        <Sparkles count={lowPower ? 25 : 60} scale={22} size={1.4} speed={motion ? 0.15 : 0} opacity={0.4} color={palette.sparkleCool} />

        <Edges graph={graph} focus={focus} stage={stage} hops={hops} palette={palette} />

        {graph.mapNodes((id, attrs) => (
          <HabitatNode
            key={id}
            node={attrs}
            vis={visibilityFor(hops.get(id), stage)}
            isFocus={id === focus}
            motion={motion}
            palette={palette}
            onFocus={onFocus}
          />
        ))}

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={4}
          maxDistance={70}
          autoRotate={motion && settings.autoRotate}
          autoRotateSpeed={0.25}
        />
        <CameraRig target={target} radius={radius} />
        <PanelViewOffset />
        <LabelProjector items={labels} layer={labelLayer} />
        <KeyboardBridge
          graph={graph}
          focus={focus}
          motion={motion}
          hints={keyboardHints}
          apiRef={apiRef}
          onCandidates={setCandidates}
        />

        {/* Unmounted (not disabled) on low power: a disabled composer still owns the
            render slot and draws nothing, which leaves the scene black. */}
        {!lowPower &&
          (palette.bloom ? (
            <EffectComposer key="glow" multisampling={4}>
              <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.18} luminanceSmoothing={0.3} />
              <Vignette offset={0.25} darkness={palette.vignette} />
            </EffectComposer>
          ) : (
            <EffectComposer key="soft" multisampling={4}>
              <Vignette offset={0.25} darkness={palette.vignette} />
            </EffectComposer>
          ))}
      </Canvas>

      <div ref={labelLayer} className={styles.labelLayer} aria-hidden>
        {labels.map((l) => (
          <div
            key={l.key}
            className={l.kind === "edge" ? styles.edgeLabel : `${styles.nodeLabel} ${l.kind === "focus" ? styles.nodeLabelFocus : ""}`}
            data-hint={l.hint}
            style={{ opacity: l.shown ? 1 : 0, visibility: l.shown ? undefined : "hidden" }}
          >
            {l.hint && <span className={styles.hintArrow}>{HINT_ARROWS[l.hint]}</span>}
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
