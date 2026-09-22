import { useEffect, useMemo, useState } from "react";
import { completeLegacyOnboarding, readLegacyOnboarding } from "../adapters/legacy-onboarding-store";
import { DeviceFrame } from "../components";
import { Onboarding } from "../pages/Onboarding/Onboarding";
import { Splash } from "../pages/Splash/Splash";
import styles from "./App.module.css";

type ApplicationPhase = "splash" | "onboarding" | "legacy";

function previewPhase() {
  if (!import.meta.env.DEV) return null;
  const state = new URLSearchParams(window.location.search).get("preview");
  return state === "splash" || state === "onboarding" ? state : null;
}

/**
 * Phase 2 owns just the launch and first-use states. Established product
 * screens stay in `iphone.html` until their dedicated migration phase.
 */
export function App() {
  const preview = useMemo(previewPhase, []);
  const preferences = useMemo(readLegacyOnboarding, []);
  const [phase, setPhase] = useState<ApplicationPhase>("splash");

  useEffect(() => {
    if (phase !== "splash") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (preview === "splash") return;
      setPhase(preview === "onboarding" || !preferences.onboardingComplete ? "onboarding" : "legacy");
    }, reducedMotion ? 0 : 950);
    return () => window.clearTimeout(timer);
  }, [phase, preferences.onboardingComplete, preview]);

  useEffect(() => {
    if (phase !== "legacy" || preview) return;
    window.location.replace("./iphone.html");
  }, [phase, preview]);

  if (phase === "splash") return <DeviceFrame page="splash"><Splash onReady={() => setPhase(preview === "onboarding" || !preferences.onboardingComplete ? "onboarding" : "legacy")} /></DeviceFrame>;
  if (phase === "onboarding") {
    return <DeviceFrame page="onboarding"><Onboarding initialIntent={preferences.onboardingIntent} onComplete={(intent) => {
      if (!preview) completeLegacyOnboarding(intent);
      setPhase("legacy");
    }} /></DeviceFrame>;
  }

  return (
    <DeviceFrame page="home"><main className={styles.handoff} aria-live="polite"><p>正在进入学程…</p></main></DeviceFrame>
  );
}
