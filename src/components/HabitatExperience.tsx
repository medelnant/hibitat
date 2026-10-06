"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { hydrateHabitat, threadsFrom, type SerializedHabitat } from "@/lib/graph";
import { STAGES, type Stage } from "@/lib/habitat-data";
import { typeLabel } from "@/lib/labels";
import {
  DEFAULT_PREFERENCES,
  usePreferences,
  useResolvedMotion,
  useResolvedTheme,
  type MotionPref,
  type QualityPref,
  type ThemePref,
} from "@/lib/preferences";
import type { SceneSettings } from "./ConstellationScene";
import type { Direction, SceneApi } from "./scene/KeyboardBridge";
import { CommandPalette, type Command } from "./ui/CommandPalette";
import { AddThreadDialog } from "./ui/AddThreadDialog";
import { DebugOverlay } from "./ui/DebugOverlay";
import { PreferencesDialog } from "./ui/PreferencesDialog";
import { ShortcutsDialog } from "./ui/ShortcutsDialog";
import styles from "./habitat.module.css";

// WebGL only exists in the browser, so the scene skips server prerendering.
const ConstellationScene = dynamic(() => import("./ConstellationScene"), {
  ssr: false,
  loading: () => <div className={styles.loading}>gathering the stars…</div>,
});

// ⌘ on Apple platforms, Ctrl elsewhere. Server render says "Ctrl"; the client corrects it.
const useModKey = () =>
  useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const DEFAULT_FOCUS = "biscuit";

const ARROWS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
const ORBIT_STEP = 0.35; // radians per Shift+arrow press
const anyDialogOpen = () => Boolean(document.querySelector("dialog[open]"));

export default function HabitatExperience({ data, initialFocus }: { data: SerializedHabitat; initialFocus?: string | null }) {
  const graph = useMemo(() => hydrateHabitat(data), [data]);
  const router = useRouter();
  const [requestedFocus, setFocus] = useState(() =>
    initialFocus && graph.hasNode(initialFocus) ? initialFocus : DEFAULT_FOCUS,
  );
  // A just-added node is requested before the refreshed graph containing it arrives;
  // until then, stay on something that exists.
  const focus = graph.hasNode(requestedFocus)
    ? requestedFocus
    : graph.hasNode(DEFAULT_FOCUS)
      ? DEFAULT_FOCUS
      : graph.nodes()[0];
  const [addThreadOpen, setAddThreadOpen] = useState(false);

  // Where you've been, for Backspace. Kept short; it's a trail, not an archive.
  const [trail, setTrail] = useState<string[]>([]);
  // One concise sentence for screen readers after each move (the panel itself is not live).
  const [announcement, setAnnouncement] = useState("");

  const describe = useCallback(
    (id: string, from?: string) => {
      if (!graph.hasNode(id)) return "";
      const n = graph.getNodeAttributes(id);
      const relation =
        from && graph.hasNode(from) && graph.hasEdge(from, id)
          ? ` Connected to ${graph.getNodeAttribute(from, "name")}: ${graph.getEdgeAttribute(from, id, "label")}.`
          : "";
      const count = graph.degree(id);
      return `${n.name}, ${typeLabel(n).toLowerCase()}.${relation} ${count} ${count === 1 ? "thread" : "threads"}.`;
    },
    [graph],
  );

  // Keep ?focus= in the address bar so reloads, shares and the exhibit page's back link
  // land on the same node. Native replaceState: Next keeps useSearchParams in sync
  // without a navigation or a server round trip.
  const showFocus = useCallback((id: string) => {
    setFocus(id);
    window.history.replaceState(null, "", `/?focus=${encodeURIComponent(id)}`);
  }, []);

  const focusOn = useCallback(
    (id: string) => {
      if (id === focus) return;
      setTrail((t) => [...t.slice(-19), focus]);
      showFocus(id);
      setAnnouncement(describe(id, focus));
    },
    [focus, describe, showFocus],
  );

  const goBack = useCallback(() => {
    const previous = trail[trail.length - 1];
    if (!previous || !graph.hasNode(previous)) {
      setAnnouncement("Nowhere to go back to.");
      return;
    }
    setTrail((t) => t.slice(0, -1));
    showFocus(previous);
    setAnnouncement(`Back to ${describe(previous)}`);
  }, [trail, graph, describe, showFocus]);
  const [stage, setStage] = useState<Stage>(2);

  const node = graph.getNodeAttributes(focus);
  const threads = useMemo(() => threadsFrom(graph, focus), [graph, focus]);
  const hint = STAGES.find((s) => s.n === stage)!.hint;

  const [prefs, setPrefs] = usePreferences();
  const theme = useResolvedTheme(prefs.theme);
  const motion = useResolvedMotion(prefs.motion);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mapKeyboard, setMapKeyboard] = useState(false); // map has keyboard focus: show arrow hints
  const sceneApi = useRef<SceneApi | null>(null);
  const mod = useModKey();

  const settings: SceneSettings = useMemo(
    () => ({ theme, motion, quality: prefs.quality, labels: prefs.labels, autoRotate: prefs.autoRotate, debug: prefs.debug }),
    [theme, motion, prefs.quality, prefs.labels, prefs.autoRotate, prefs.debug],
  );

  // Keep the page chrome (CSS tokens) in step with the resolved theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // ⌘K / Ctrl+K opens the palette anywhere; backtick toggles the debug overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPrefsOpen(false);
        setPaletteOpen((open) => !open);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || anyDialogOpen()) return;
      if (e.key === "`") {
        setPrefs({ debug: !prefs.debug });
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        const next = Number(e.key) as Stage;
        setStage(next);
        setAnnouncement(`${STAGES.find((s) => s.n === next)!.label}.`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.debug, setPrefs]);

  const openPrimary = useCallback(() => {
    if (graph.getNodeAttribute(focus, "type") === "exhibit") {
      router.push(`/exhibit/${focus}`);
    } else {
      setStage(1);
      setAnnouncement(`Nearby: ${describe(focus)}`);
    }
  }, [graph, focus, router, describe]);

  // Keys that act on the map itself; only while the map region has focus.
  const onMapKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const api = sceneApi.current;
    const dir = ARROWS[e.key];
    let handled = true;

    if (dir && e.shiftKey) {
      const az = dir === "left" ? -ORBIT_STEP : dir === "right" ? ORBIT_STEP : 0;
      const pol = dir === "up" ? -ORBIT_STEP * 0.7 : dir === "down" ? ORBIT_STEP * 0.7 : 0;
      api?.orbit(az, pol);
    } else if (dir) {
      const target = api?.pick(dir) ?? null;
      if (target) focusOn(target);
      else setAnnouncement(`No thread leads ${dir} from ${graph.getNodeAttribute(focus, "name")}.`);
    } else if (e.key === "+" || e.key === "=") {
      api?.zoom(0.8);
    } else if (e.key === "-" || e.key === "_") {
      api?.zoom(1.25);
    } else if (e.key === "Enter") {
      openPrimary();
    } else if (e.key === "Backspace") {
      goBack();
    } else if (e.key === " ") {
      setPrefs({ autoRotate: !prefs.autoRotate });
      setAnnouncement(prefs.autoRotate ? "Drift paused." : "Drift resumed.");
    } else if (e.key === "t" || e.key === "T") {
      setAddThreadOpen(true);
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      setMapKeyboard(true); // a mouse user who starts using keys gets the hints too
    }
  };

  const commands = useMemo<Command[]>(() => {
    const current = (on: boolean) => (on ? "current" : undefined);
    const list: Command[] = [];

    graph.forEachNode((id, n) => {
      list.push({
        id: `go-${id}`,
        group: "Go to",
        label: n.name,
        hint: id === focus ? "current" : typeLabel(n).toLowerCase(),
        keywords: `${n.sub} ${n.type} ${n.kind ?? ""}`,
        run: () => focusOn(id),
      });
    });

    STAGES.forEach((s) =>
      list.push({ id: `stage-${s.n}`, group: "View", label: s.label, hint: current(s.n === stage), keywords: s.hint, run: () => setStage(s.n) }),
    );

    const themes: [ThemePref, string][] = [["dark", "Dark"], ["light", "Light"], ["system", "Match system"]];
    themes.forEach(([value, label]) =>
      list.push({ id: `theme-${value}`, group: "Theme", label: `${label} theme`, hint: current(prefs.theme === value), keywords: "appearance mode colour color", run: () => setPrefs({ theme: value }) }),
    );

    const motions: [MotionPref, string][] = [["full", "Full motion"], ["reduced", "Reduced motion"], ["system", "Motion: match system"]];
    motions.forEach(([value, label]) =>
      list.push({ id: `motion-${value}`, group: "Motion", label, hint: current(prefs.motion === value), keywords: "animation accessibility", run: () => setPrefs({ motion: value }) }),
    );

    const qualities: [QualityPref, string][] = [["auto", "Auto"], ["high", "High"], ["low", "Low"]];
    qualities.forEach(([value, label]) =>
      list.push({ id: `quality-${value}`, group: "Performance", label: `Quality: ${label}`, hint: current(prefs.quality === value), keywords: "rendering performance battery bloom", run: () => setPrefs({ quality: value }) }),
    );

    list.push(
      { id: "toggle-debug", group: "Performance", label: prefs.debug ? "Hide debug overlay" : "Show debug overlay", hint: "`", keywords: "fps stats draw calls", run: () => setPrefs({ debug: !prefs.debug }) },
      { id: "toggle-labels", group: "Display", label: prefs.labels ? "Hide labels" : "Show labels", keywords: "names text", run: () => setPrefs({ labels: !prefs.labels }) },
      { id: "toggle-rotate", group: "Display", label: prefs.autoRotate ? "Stop slow drift" : "Start slow drift", keywords: "auto rotate spin", run: () => setPrefs({ autoRotate: !prefs.autoRotate }) },
      { id: "shortcuts", group: "Preferences", label: "Keyboard shortcuts", hint: "?", keywords: "keys help navigate arrows", run: () => setShortcutsOpen(true) },
      ...(graph.getNodeAttribute(focus, "type") === "exhibit"
        ? [{ id: "open-exhibit", group: "Go to", label: `Open ${graph.getNodeAttribute(focus, "name")}’s full exhibit`, keywords: "page details", run: () => router.push(`/exhibit/${focus}`) }]
        : []),
      { id: "open-prefs", group: "Preferences", label: "Open preferences…", keywords: "settings options", run: () => setPrefsOpen(true) },
      { id: "reset-prefs", group: "Preferences", label: "Reset preferences", keywords: "defaults", run: () => setPrefs(DEFAULT_PREFERENCES) },
    );
    return list;
  }, [graph, focus, stage, prefs, setPrefs, focusOn, router]);

  return (
    <main className={styles.shell}>
      <div
        className={styles.mapRegion}
        tabIndex={0}
        role="application"
        aria-roledescription="habitat map"
        aria-label={`Habitat map, centred on ${node.name}`}
        aria-describedby="map-keys"
        onKeyDown={onMapKey}
        onFocus={(e) => e.target === e.currentTarget && setMapKeyboard(e.currentTarget.matches(":focus-visible"))}
        onBlur={(e) => e.target === e.currentTarget && setMapKeyboard(false)}
      >
        <ConstellationScene
          graph={graph}
          focus={focus}
          stage={stage}
          settings={settings}
          keyboardHints={mapKeyboard}
          apiRef={sceneApi}
          onFocus={focusOn}
        />
      </div>
      <p id="map-keys" className={styles.srOnly}>
        Arrow keys move to the connected node in that direction. Enter opens it. Backspace goes back. Shift with arrows
        turns the view; plus and minus zoom. Press question mark for all shortcuts.
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>

      <div className={styles.frame} aria-hidden />
      <div className={styles.mapRing} aria-hidden />

      <header className={styles.brand}>
        <h1 className={styles.wordmark}>HIBITAT</h1>
        <p className={styles.tagline}>every memory is connected to someone</p>
      </header>

      <nav className={styles.stages} aria-label="How far to look">
        <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.commandButton}
          onClick={() => setPaletteOpen(true)}
          aria-haspopup="dialog"
          aria-label="Open command palette"
          aria-keyshortcuts="Meta+K Control+K"
        >
          <span>Commands</span>
          <kbd>{mod}K</kbd>
        </button>
        <div className={styles.stagePills}>
          {STAGES.map((s) => (
            <button
              key={s.n}
              type="button"
              className={styles.stagePill}
              aria-pressed={s.n === stage}
              onClick={() => setStage(s.n)}
            >
              {s.label}
            </button>
          ))}
        </div>
        </div>
        <p className={styles.stageHint}>{hint}</p>
      </nav>

      {prefs.debug && (
        <DebugOverlay
          focus={node.name}
          stage={STAGES.find((s) => s.n === stage)!.label}
          onClose={() => setPrefs({ debug: false })}
        />
      )}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {addThreadOpen && (
        <AddThreadDialog graph={graph} from={focus} onAdded={focusOn} onClose={() => setAddThreadOpen(false)} />
      )}
      {shortcutsOpen && <ShortcutsDialog mod={mod} onClose={() => setShortcutsOpen(false)} />}
      {prefsOpen && <PreferencesDialog prefs={prefs} onChange={setPrefs} onClose={() => setPrefsOpen(false)} />}

      <ul className={styles.legend} aria-label="Legend">
        <li><span className={styles.swExhibit} />exhibit</li>
        <li><span className={styles.swCurator} />curator</li>
        <li><span className={styles.swCommunity} />community</li>
        <li><span className={styles.swCurates} />curates</li>
        <li className={styles.legendHint}>drag to orbit · scroll to zoom</li>
      </ul>

      <aside className={styles.panel} aria-label={`About ${node.name}`}>
        <div className={styles.panelType}>{typeLabel(node)}</div>

        <div className={styles.hero}>
          <div
            className={styles.heroBadge}
            data-type={node.type}
            style={{ "--node": node.color } as React.CSSProperties}
          >
            {node.name.charAt(0)}
          </div>
          <div>
            <h2 className={styles.heroName}>{node.name}</h2>
            {node.sub && <div className={styles.heroSub}>{node.sub}</div>}
          </div>
        </div>

        {node.story && <p className={styles.story}>{node.story}</p>}

        {node.curatedBy && (
          <div className={styles.curated}>
            Curated by <strong>{node.curatedBy}</strong> · {node.curatedSince}
          </div>
        )}

        <section>
          <h3 className={styles.threadsTitle}>threads from here</h3>
          <div className={styles.threads}>
            {threads.map((t) => {
              const n = graph.getNodeAttributes(t.id);
              return (
                <button key={t.id} type="button" className={styles.thread} onClick={() => focusOn(t.id)}>
                  <span
                    className={styles.threadBadge}
                    data-type={n.type}
                    style={{ "--node": n.color } as React.CSSProperties}
                  >
                    {n.name.charAt(0)}
                  </span>
                  <span className={styles.threadText}>
                    <span className={styles.threadName}>{n.name}</span>
                    <span className={styles.threadLabel}>{t.label}</span>
                  </span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M5 3 L9 7 L5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })}
          </div>
        </section>

        <div className={styles.actions}>
          {node.type === "exhibit" ? (
            <Link href={`/exhibit/${focus}`} className={styles.primary}>
              Open the full exhibit
            </Link>
          ) : (
            <button type="button" className={styles.primary} onClick={() => setStage(1)}>
              Show their threads
            </button>
          )}
          <button type="button" className={styles.secondary} aria-haspopup="dialog" onClick={() => setAddThreadOpen(true)}>
            Add a thread
          </button>
        </div>
      </aside>
    </main>
  );
}
