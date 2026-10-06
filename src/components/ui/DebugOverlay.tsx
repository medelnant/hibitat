"use client";

import { useSceneStats } from "@/lib/debug-store";
import styles from "./ui.module.css";

const fmt = (n: number, digits = 0) => n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function DebugOverlay({ focus, stage, onClose }: { focus: string; stage: string; onClose: () => void }) {
  const s = useSceneStats();

  const rows: [string, string][] = s
    ? [
        ["fps", `${fmt(s.fps)}${s.frameloop === "demand" ? " (on demand)" : ""}`],
        ["frame", `${fmt(s.frameMs, 1)} ms · worst ${fmt(s.worstMs, 1)}`],
        ["draw calls", fmt(s.drawCalls)],
        ["triangles", fmt(s.triangles)],
        ["geometries", fmt(s.geometries)],
        ["textures", fmt(s.textures)],
        ["shaders", fmt(s.programs)],
        ["quality", `${s.quality} · ${s.qualityReason}`],
        ["pixels", `${s.width}×${s.height} @${fmt(s.dpr, 2)}x`],
        ["camera", `${fmt(s.cameraDistance, 1)} units`],
        ["focus", `${focus} · ${stage}`],
        ...(s.heapMB !== null ? ([["js heap", `${fmt(s.heapMB, 1)} MB`]] as [string, string][]) : []),
      ]
    : [];

  return (
    <section className={styles.debug} aria-label="Debug overlay">
      <header className={styles.debugHeader}>
        <span>debug</span>
        <button type="button" className={styles.debugClose} onClick={onClose} aria-label="Hide debug overlay">
          ×
        </button>
      </header>
      {s ? (
        <dl className={styles.debugGrid}>
          {rows.map(([k, v]) => (
            <div key={k} className={styles.debugRow}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={styles.debugWaiting}>measuring…</p>
      )}
    </section>
  );
}
