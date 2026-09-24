import type { PropsWithChildren } from "react";
import styles from "./DeviceFrame.module.css";

export type DeviceFramePage = "splash" | "onboarding" | "home" | "conversation" | "schedule" | "profile";

export interface DeviceFrameProps extends PropsWithChildren {
  /** Splash retains its Pixso launch spacing; other pages receive the simulated safe areas. */
  page: DeviceFramePage;
}

/**
 * Preview-only iPhone canvas. It does not ship inside the legacy Capacitor
 * surface and does not own product state or page navigation.
 */
export function DeviceFrame({ children, page }: DeviceFrameProps) {
  return (
    <div className={styles.browserBackground}>
      <section aria-label="iPhone 学程预览" className={styles.frame} data-page={page}>
        <header aria-hidden="true" className={styles.statusBar}>
          <time>9:41</time>
          <span className={styles.statusIcons}><i className={styles.signal} /><i className={styles.wifi} /><i className={styles.battery} /></span>
        </header>
        <div className={styles.safeArea}>{children}</div>
        <footer aria-hidden="true" className={styles.homeIndicator}><i /></footer>
      </section>
    </div>
  );
}
