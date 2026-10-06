import Link from "next/link";
import styles from "./exhibit/[id]/exhibit.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.frame} aria-hidden />
      <div className={styles.notFound}>
        <p className={styles.type}>Not in the habitat</p>
        <h1 className={styles.name}>We couldn’t find that page</h1>
        <p className={styles.sub}>It may have moved, or it hasn’t been added to the habitat yet.</p>
        <Link href="/" className={styles.homeLink}>
          Back to the habitat
        </Link>
      </div>
    </main>
  );
}
