import styles from "./Splash.module.css";

export interface SplashProps {
  onReady: () => void;
}

/** Pixso Frame3382: a self-contained launch state, never an onboarding step. */
export function Splash({ onReady }: SplashProps) {
  return (
    <main className={styles.page} aria-label="学程启动中">
      <div className={styles.status} aria-hidden="true"><span>9:41</span><span>● ◒ ▰</span></div>
      <section className={styles.brand} aria-label="学程，安静地陪你走好下一步">
        <img alt="" className={styles.mark} src="/assets/xuecheng-mark.svg" />
        <h1>学程</h1>
        <p className={styles.english}>XUECHENG</p>
        <p className={styles.tagline}>安静地陪你走好下一步</p>
      </section>
      <button className={styles.loading} type="button" aria-label="正在准备今天的学习" onClick={onReady}>
        <span aria-hidden="true"><i /></span>正在准备今天的学习
      </button>
    </main>
  );
}
