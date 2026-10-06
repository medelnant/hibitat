"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ui.module.css";

export interface Command {
  id: string;
  group: string;
  label: string;
  /** Right-aligned note: a shortcut, or "current" for the active choice. */
  hint?: string;
  keywords?: string;
  run: () => void;
}

function matches(command: Command, query: string) {
  const haystack = `${command.group} ${command.label} ${command.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Rendered only while open, so every opening starts with an empty query.
 * Uses the native <dialog> for focus trapping, Escape and the backdrop.
 */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => commands.filter((c) => matches(c, query)), [commands, query]);
  const active = Math.min(activeIndex, Math.max(results.length - 1, 0));
  const activeId = results[active] ? `command-${results[active].id}` : undefined;

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

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((active + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((active - 1 + results.length) % results.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={styles.palette}
      aria-label="Command palette"
      onClick={(e) => {
        if (e.target === dialog.current) close(); // click on the backdrop
      }}
    >
      <div className={styles.paletteSearch}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
          <line x1="10.8" y1="10.8" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          className={styles.paletteInput}
          placeholder="Search people, places, settings…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className={styles.kbd}>esc</kbd>
      </div>

      <ul id="command-list" role="listbox" aria-label="Commands" className={styles.paletteList}>
        {results.map((command, i) => {
          const heading = i === 0 || results[i - 1].group !== command.group ? command.group : null;
          return (
            <li key={command.id} role="presentation">
              {heading && <div className={styles.paletteGroup} aria-hidden>{heading}</div>}
              <div
                id={`command-${command.id}`}
                role="option"
                aria-selected={i === active}
                className={styles.paletteItem}
                onMouseMove={() => i !== active && setActiveIndex(i)}
                onClick={() => run(command)}
              >
                <span>{command.label}</span>
                {command.hint && <span className={styles.paletteHint}>{command.hint}</span>}
              </div>
            </li>
          );
        })}
        {!results.length && <li className={styles.paletteEmpty}>Nothing matches “{query}”.</li>}
      </ul>
    </dialog>
  );
}
