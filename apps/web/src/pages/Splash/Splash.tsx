import styles from "./Splash.module.css";

/** Pixso Frame3382: a self-contained launch state, never an onboarding step. */
export function Splash() {
  return (
    <main className={styles.page} aria-label="学程启动中">
      <section className={styles.brand} aria-label="学程，安静地陪你走好下一步">
        <img alt="" className={styles.mark} src="/assets/xuecheng-mark.svg" />
        <h1>学程</h1>
        <p className={styles.tagline}>陪你，走更远的路</p>
      </section>
    </main>
  );
}
