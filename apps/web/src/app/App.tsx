import { useEffect, useMemo, useState } from "react";
import { completeLegacyOnboarding, readLegacyOnboarding } from "../adapters/legacy-onboarding-store";
import { DeviceFrame } from "../components";
import { useLegacySnapshot } from "../hooks/useLegacySnapshot";
import { HomePage } from "../pages";
import { Onboarding } from "../pages/Onboarding/Onboarding";
import { Splash } from "../pages/Splash/Splash";

type ApplicationPhase = "splash" | "onboarding" | "application";

function previewPhase() {
  if (!import.meta.env.DEV) return null;
  const state = new URLSearchParams(window.location.search).get("preview");
  return state === "splash" || state === "onboarding" || state === "home" ? state : null;
}

/**
 * Launch state stays distinct from the authenticated/local product shell.
 */
export function App() {
  const preview = useMemo(previewPhase, []);
  const preferences = useMemo(readLegacyOnboarding, []);
  const snapshot = useLegacySnapshot();
  const [phase, setPhase] = useState<ApplicationPhase>("splash");

  useEffect(() => {
    if (phase !== "splash") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (preview === "splash") return;
      setPhase(preview === "onboarding" || !preferences.onboardingComplete ? "onboarding" : "application");
    }, reducedMotion ? 0 : 950);
    return () => window.clearTimeout(timer);
  }, [phase, preferences.onboardingComplete, preview]);

  useEffect(() => { if (preview === "home") setPhase("application"); }, [preview]);

  if (phase === "splash") return <DeviceFrame page="splash"><Splash /></DeviceFrame>;
  if (phase === "onboarding") {
    return <DeviceFrame page="onboarding"><Onboarding initialIntent={preferences.onboardingIntent} onComplete={(intent) => {
      if (!preview) completeLegacyOnboarding(intent);
      setPhase("application");
    }} /></DeviceFrame>;
  }

  return <DeviceFrame page="home"><HomePage snapshot={snapshot} onNavigate={() => {}} /></DeviceFrame>;
}
