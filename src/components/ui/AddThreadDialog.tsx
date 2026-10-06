"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addThread, createAndLink } from "@/app/actions";
import type { HabitatGraph } from "@/lib/graph";
import { typeLabel } from "@/lib/labels";
import styles from "./ui.module.css";

const NEW = "__new__";
const SUGGESTIONS = ["best friends", "family", "grew up with", "adopted from", "curates", "walks with", "remembers"];

type NewType = "exhibit" | "curator" | "community";
type NewKind = "animal" | "place" | "thing";

/** Rendered only while open. Calls onAdded with the node to focus once the thread is saved. */
export function AddThreadDialog({
  graph,
  from,
  onAdded,
  onClose,
}: {
  graph: HabitatGraph;
  from: string;
  onAdded: (focus: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("");
  const [target, setTarget] = useState<string>("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<NewType>("exhibit");
  const [kind, setKind] = useState<NewKind>("animal");
  const [name, setName] = useState("");
  const [sub, setSub] = useState("");
  const [story, setStory] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: stays empty for people
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fromName = graph.getNodeAttribute(from, "name");

  // Everyone not already connected to `from`, filtered by the search box.
  const candidates = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return graph
      .mapNodes((id, a) => ({ id, a }))
      .filter(({ id }) => id !== from && !graph.hasEdge(from, id))
      .filter(({ a }) => !q || `${a.name} ${a.sub} ${a.type}`.toLowerCase().includes(q));
  }, [graph, from, filter]);

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!target) return setError("Choose who or what to connect to.");
    if (!label.trim()) return setError("Name the relationship.");
    if (target === NEW && !name.trim()) return setError("Give them a name.");

    startTransition(async () => {
      const result =
        target === NEW
          ? await createAndLink({
              from,
              label,
              website,
              node: { type, kind: type === "exhibit" ? kind : undefined, name, sub, story },
            })
          : await addThread({ from, to: target, label, website });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAdded(result.focus);
      close();
    });
  };

  return (
    <dialog
      ref={dialog}
      className={`${styles.prefs} ${styles.addThread}`}
      aria-labelledby="add-thread-title"
      onClick={(e) => {
        if (e.target === dialog.current && !pending) close();
      }}
    >
      <form onSubmit={submit} noValidate>
        <div className={styles.prefsHeader}>
          <h2 id="add-thread-title" className={styles.prefsTitle}>
            Add a thread
          </h2>
          <p className={styles.prefsNote}>
            From <strong>{fromName}</strong> to someone or something in the habitat, or someone new.
          </p>
        </div>

        <div className={styles.prefsBody}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Connect to</legend>
            <input
              type="search"
              className={styles.textInput}
              placeholder="Filter by name…"
              aria-label="Filter the habitat"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className={styles.targetList}>
              {candidates.map(({ id, a }) => (
                <label key={id} className={styles.targetOption}>
                  <input type="radio" name="target" value={id} checked={target === id} onChange={() => setTarget(id)} />
                  <span className={styles.targetBadge} data-type={a.type} style={{ "--node": a.color } as React.CSSProperties}>
                    {a.name.charAt(0)}
                  </span>
                  <span className={styles.targetText}>
                    <span>{a.name}</span>
                    <span className={styles.targetMeta}>{typeLabel(a).toLowerCase()}</span>
                  </span>
                </label>
              ))}
              {!candidates.length && <p className={styles.targetEmpty}>No one else matches. Add them as someone new.</p>}
              <label className={`${styles.targetOption} ${styles.targetNew}`}>
                <input
                  type="radio"
                  name="target"
                  value={NEW}
                  checked={target === NEW}
                  onChange={() => {
                    setTarget(NEW);
                    if (!name && filter.trim()) setName(filter.trim());
                  }}
                />
                <span className={styles.targetBadge} aria-hidden>
                  +
                </span>
                <span className={styles.targetText}>
                  <span>Someone or something new</span>
                  <span className={styles.targetMeta}>an animal, person, place, thing or community</span>
                </span>
              </label>
            </div>
          </fieldset>

          {target === NEW && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Who or what are they?</legend>
              <div className={styles.segmented} role="radiogroup" aria-label="Kind of entry">
                {(
                  [
                    ["exhibit", "Exhibit"],
                    ["curator", "Curator"],
                    ["community", "Community"],
                  ] as const
                ).map(([value, text]) => (
                  <label key={value} className={styles.segment}>
                    <input type="radio" name="type" checked={type === value} onChange={() => setType(value)} />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
              {type === "exhibit" && (
                <div className={styles.segmented} role="radiogroup" aria-label="Exhibit of">
                  {(
                    [
                      ["animal", "An animal"],
                      ["place", "A place"],
                      ["thing", "A thing"],
                    ] as const
                  ).map(([value, text]) => (
                    <label key={value} className={styles.segment}>
                      <input type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)} />
                      <span>{text}</span>
                    </label>
                  ))}
                </div>
              )}
              <label className={styles.field}>
                <span>Name</span>
                <input className={styles.textInput} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
              </label>
              <label className={styles.field}>
                <span>
                  Short description <em>optional</em>
                </span>
                <input
                  className={styles.textInput}
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                  maxLength={120}
                  placeholder={type === "exhibit" ? "e.g. Tabby cat · b. 2019" : type === "curator" ? "e.g. Winter Park, FL" : "e.g. Volunteers and fosters"}
                />
              </label>
              <label className={styles.field}>
                <span>
                  Their story <em>optional</em>
                </span>
                <textarea className={styles.textArea} rows={3} value={story} onChange={(e) => setStory(e.target.value)} maxLength={1200} />
              </label>
            </fieldset>
          )}

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>The relationship</legend>
            <input
              className={styles.textInput}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
              placeholder="e.g. best friends"
              aria-label="Relationship"
            />
            <div className={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className={styles.chip} aria-pressed={label === s} onClick={() => setLabel(s)}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
          <input
            className={styles.honeypot}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <p className={styles.formError} role="alert">
            {error}
          </p>
        </div>

        <div className={styles.prefsFooter}>
          <button type="button" className={styles.ghostButton} onClick={close} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className={styles.solidButton} disabled={pending}>
            {pending ? "Adding…" : "Add thread"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
