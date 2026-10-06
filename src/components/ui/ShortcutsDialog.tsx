"use client";

import { useEffect, useRef } from "react";
import styles from "./ui.module.css";

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: "On the map",
    keys: [
      [["←", "↑", "→", "↓"], "Move to the connected node in that direction"],
      [["Enter"], "Open the full exhibit (or show a curator’s threads)"],
      [["Backspace"], "Go back to where you were"],
      [["Shift", "+ arrows"], "Turn the view"],
      [["+", "−"], "Zoom in and out"],
      [["Space"], "Pause or resume the slow drift"],
      [["T"], "Add a thread"],
    ],
  },
  {
    title: "Anywhere",
    keys: [
      [["1", "2", "3"], "Nearby · Neighborhood · Whole habitat"],
      [["MOD", "K"], "Command palette"],
      [["?"], "This list"],
      [["`"], "Debug overlay"],
      [["Tab"], "Move between the map, the panel’s threads and buttons"],
    ],
  },
];

/** Rendered only while open. */
export function ShortcutsDialog({ mod, onClose }: { mod: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="shortcuts-title"
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className={styles.prefsHeader}>
        <h2 id="shortcuts-title" className={styles.prefsTitle}>
          Keyboard shortcuts
        </h2>
        <p className={styles.prefsNote}>Click the map or Tab to it first for the map keys.</p>
      </div>
      <div className={styles.prefsBody}>
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className={styles.legend}>{group.title}</h3>
            <dl className={styles.shortcuts}>
              {group.keys.map(([keys, what]) => (
                <div key={what} className={styles.shortcutRow}>
                  <dt>
                    {keys.map((k) =>
                      k.startsWith("+ ") ? (
                        <span key={k} className={styles.shortcutPlus}>
                          {k}
                        </span>
                      ) : (
                        <kbd key={k} className={styles.kbd}>
                          {k === "MOD" ? mod : k}
                        </kbd>
                      ),
                    )}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className={styles.prefsFooter}>
        <span />
        <button type="button" className={styles.solidButton} onClick={close} autoFocus>
          Done
        </button>
      </div>
    </dialog>
  );
}
