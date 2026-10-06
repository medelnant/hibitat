"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  sanitize,
  type MotionPref,
  type Preferences,
  type ThemePref,
} from "./preferences-core";

export * from "./preferences-core";

let current: Preferences | null = null;
const listeners = new Set<() => void>();

function load(): Preferences {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    return sanitize(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_PREFERENCES; // private mode, blocked storage, corrupt JSON
  }
}

export const preferencesStore = {
  get(): Preferences {
    if (!current) current = load();
    return current;
  },
  set(patch: Partial<Preferences>) {
    current = { ...preferencesStore.get(), ...patch };
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(current));
    } catch {
      // storage unavailable: keep the in-memory value for this visit
    }
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
  const prefs = useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get, () => DEFAULT_PREFERENCES);
  return [prefs, preferencesStore.set];
}

/* ---------- system media queries, resolved against the user's choice ---------- */

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useResolvedTheme(pref: ThemePref): "dark" | "light" {
  const systemLight = useMediaQuery("(prefers-color-scheme: light)");
  if (pref === "system") return systemLight ? "light" : "dark";
  return pref;
}

/** True when the scene should animate on its own. */
export function useResolvedMotion(pref: MotionPref): boolean {
  const systemReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  if (pref === "system") return !systemReduced;
  return pref === "full";
}

