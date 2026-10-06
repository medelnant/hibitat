"use client";

import { useEffect, useRef } from "react";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences-core";
import styles from "./ui.module.css";

interface Choice<T extends string> {
  value: T;
  label: string;
}

function RadioGroup<T extends string>({
  legend,
  name,
  value,
  choices,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  choices: Choice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.segmented}>
        {choices.map((c) => (
          <label key={c.value} className={styles.segment}>
            <input type="radio" name={name} value={c.value} checked={value === c.value} onChange={() => onChange(c.value)} />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.toggleRow}>
      <span>
        <span className={styles.toggleLabel}>{label}</span>
        {hint && <span className={styles.toggleHint}>{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className={styles.switch} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Rendered only while open. Changes apply immediately and are saved in this browser. */
export function PreferencesDialog({
  prefs,
  onChange,
  onClose,
}: {
  prefs: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Every way out tells the parent straight away: Escape fires the synchronous "cancel"
  // event, and our own buttons call close(). The native "close" event is only a backstop,
  // since browsers may hold it until the next animation frame.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (!el.open) el.showModal();
    el.addEventListener("cancel", onClose);
    el.addEventListener("close", onClose);
    return () => {
      el.removeEventListener("cancel", onClose);
      el.removeEventListener("close", onClose);
    };
  }, [onClose]);

  const close = () => {
    dialog.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className={styles.prefs}
      aria-labelledby="prefs-title"
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className={styles.prefsHeader}>
        <h2 id="prefs-title" className={styles.prefsTitle}>Preferences</h2>
        <p className={styles.prefsNote}>Saved in this browser.</p>
      </div>

      <div className={styles.prefsBody}>
        <RadioGroup
          legend="Theme"
          name="theme"
          value={prefs.theme}
          onChange={(theme) => onChange({ theme })}
          choices={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
            { value: "system", label: "System" },
          ]}
        />
        <RadioGroup
          legend="Motion"
          name="motion"
          value={prefs.motion}
          onChange={(motion) => onChange({ motion })}
          choices={[
            { value: "full", label: "Full" },
            { value: "reduced", label: "Reduced" },
            { value: "system", label: "System" },
          ]}
        />
        <RadioGroup
          legend="Rendering quality"
          name="quality"
          value={prefs.quality}
          onChange={(quality) => onChange({ quality })}
          choices={[
            { value: "auto", label: "Auto" },
            { value: "high", label: "High" },
            { value: "low", label: "Low" },
          ]}
        />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Display</legend>
          <Toggle label="Labels" hint="Names and relationships on the map" checked={prefs.labels} onChange={(labels) => onChange({ labels })} />
          <Toggle
            label="Slow drift"
            hint="The habitat turns gently on its own"
            checked={prefs.autoRotate}
            onChange={(autoRotate) => onChange({ autoRotate })}
          />
          <Toggle label="Debug overlay" hint="Frame rate, draw calls, memory" checked={prefs.debug} onChange={(debug) => onChange({ debug })} />
        </fieldset>
      </div>

      <div className={styles.prefsFooter}>
        <button type="button" className={styles.ghostButton} onClick={() => onChange(DEFAULT_PREFERENCES)}>
          Reset to defaults
        </button>
        <button type="button" className={styles.solidButton} onClick={close}>
          Done
        </button>
      </div>
    </dialog>
  );
}
