// Server-safe pieces of preferences: types, defaults and the pre-paint theme script.

export type ThemePref = "system" | "dark" | "light";
export type QualityPref = "auto" | "high" | "low";
export type MotionPref = "system" | "full" | "reduced";

export interface Preferences {
  theme: ThemePref;
  quality: QualityPref;
  motion: MotionPref;
  labels: boolean;
  autoRotate: boolean;
  debug: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  quality: "auto",
  motion: "system",
  labels: true,
  autoRotate: true,
  debug: false,
};

export const PREFERENCES_KEY = "hibitat:preferences";

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

/** Accepts anything (old versions, hand edits) and returns a valid Preferences object. */
export function sanitize(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFERENCES;
  return {
    theme: oneOf(r.theme, ["system", "dark", "light"] as const, d.theme),
    quality: oneOf(r.quality, ["auto", "high", "low"] as const, d.quality),
    motion: oneOf(r.motion, ["system", "full", "reduced"] as const, d.motion),
    labels: typeof r.labels === "boolean" ? r.labels : d.labels,
    autoRotate: typeof r.autoRotate === "boolean" ? r.autoRotate : d.autoRotate,
    debug: typeof r.debug === "boolean" ? r.debug : d.debug,
  };
}

/**
 * Inline script for <head>: applies the saved theme before first paint so a light-mode
 * visitor never sees a dark flash while React loads.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFERENCES_KEY,
)})||"{}");var t=p.theme==="light"||p.theme==="dark"?p.theme:p.theme==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):${JSON.stringify(
  DEFAULT_PREFERENCES.theme,
)};document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme=${JSON.stringify(
  DEFAULT_PREFERENCES.theme,
)};}})();`;
