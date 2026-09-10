import styles from "./page.module.css";

export default function Loading() {
  return (
    <main className={styles.loadingScreen} aria-label="Loading workspace">
      <section className={styles.loadingPanel}>
        <span />
        <div>
          <strong>Loading Growth Intelligence</strong>
          <p>Preparing your private workspace.</p>
        </div>
      </section>
    </main>
  );
}
