import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { threadsFrom } from "@/lib/graph";
import { listExhibitIds, loadHabitatGraph } from "@/lib/habitat-repo";
import { nodeHref, typeLabel } from "@/lib/labels";
import styles from "./exhibit.module.css";

// Exhibits that exist at build time are prerendered. Ones added later are rendered on their
// first visit and cached from then on; ids that aren't exhibits 404.
export async function generateStaticParams() {
  return (await listExhibitIds()).map((id) => ({ id }));
}

// cache(): the metadata and the page share one database read per request.
const loadExhibit = cache(async (id: string) => {
  const graph = await loadHabitatGraph();
  if (!graph.hasNode(id) || graph.getNodeAttribute(id, "type") !== "exhibit") return null;
  return { graph, node: graph.getNodeAttributes(id) };
});

export async function generateMetadata({ params }: PageProps<"/exhibit/[id]">): Promise<Metadata> {
  const { id } = await params;
  const node = (await loadExhibit(id))?.node;
  if (!node) return { title: "Not in the habitat · HIBITAT" };
  return { title: `${node.name} · HIBITAT`, description: [node.sub, node.story].filter(Boolean).join(". ") };
}

export default async function ExhibitPage({ params }: PageProps<"/exhibit/[id]">) {
  const { id } = await params;
  const found = await loadExhibit(id);
  if (!found) notFound();
  const { graph, node } = found;
  const threads = threadsFrom(graph, id).map((t) => ({ ...t, node: graph.getNodeAttributes(t.id) }));
  const badge = { "--node": node.color } as React.CSSProperties;

  return (
    <main className={styles.page}>
      <div className={styles.frame} aria-hidden />

      <nav className={styles.topbar} aria-label="Exhibit">
        <Link href={`/?focus=${id}`} className={styles.back}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M8.5 3 L4.5 7 L8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          back to the habitat
        </Link>
        <span className={styles.wordmark}>HIBITAT</span>
      </nav>

      <article className={styles.exhibit}>
        <header className={styles.hero}>
          {/* stacked keepsake cards, from the earlier mobile exhibit design */}
          <div className={styles.stack} style={badge} aria-hidden>
            <div className={styles.cardBack} />
            <div className={styles.cardMid} />
            <div className={styles.cardFront}>
              <span>{node.name.charAt(0)}</span>
            </div>
          </div>

          <p className={styles.type}>{typeLabel(node)}</p>
          <h1 className={styles.name}>{node.name}</h1>
          {node.sub && <p className={styles.sub}>{node.sub}</p>}
        </header>

        {node.story && <p className={styles.story}>{node.story}</p>}

        {node.curatedBy && (
          <p className={styles.curated}>
            Curated by <strong>{node.curatedBy}</strong> · {node.curatedSince}
          </p>
        )}

        <section aria-labelledby="threads-title" className={styles.threadsSection}>
          <h2 id="threads-title" className={styles.threadsTitle}>
            threads from here
          </h2>
          <ul className={styles.threads}>
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={nodeHref(t.node)} className={styles.thread}>
                  <span
                    className={styles.threadBadge}
                    data-type={t.node.type}
                    style={{ "--node": t.node.color } as React.CSSProperties}
                  >
                    {t.node.name.charAt(0)}
                  </span>
                  <span className={styles.threadText}>
                    <span className={styles.threadName}>{t.node.name}</span>
                    <span className={styles.threadLabel}>{t.label}</span>
                  </span>
                  <span className={styles.threadKind}>{t.node.type === "exhibit" ? "exhibit" : "on the map"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
