import { useEffect, useMemo, useState } from "react";
import { completeLegacyOnboarding, readLegacyOnboarding } from "../adapters/legacy-onboarding-store";
import { DeviceFrame } from "../components";
import { useLegacySnapshot } from "../hooks/useLegacySnapshot";
import { ConversationPage, HomePage, PathPage, ProfilePage, SchedulePage } from "../pages";
import { Onboarding } from "../pages/Onboarding/Onboarding";
import { Splash } from "../pages/Splash/Splash";

type ApplicationPhase = "splash" | "onboarding" | "application";
type ProductPage = "home" | "conversation" | "schedule" | "path" | "profile";

function previewPhase() {
  if (!import.meta.env.DEV) return null;
  const state = new URLSearchParams(window.location.search).get("preview");
  return state === "splash" || state === "onboarding" || state === "home" || state === "conversation" || state === "schedule" || state === "path" || state === "profile" ? state : null;
}

/**
 * Launch state stays distinct from the authenticated/local product shell.
 */
export function App() {
  const preview = useMemo(previewPhase, []);
  const preferences = useMemo(readLegacyOnboarding, []);
  const snapshot = useLegacySnapshot();
  const [page, setPage] = useState<ProductPage>(preview && ["conversation", "schedule", "path", "profile"].includes(preview) ? preview as ProductPage : "home");
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

  useEffect(() => { if (preview && ["home", "conversation", "schedule", "path", "profile"].includes(preview)) { setPage(preview as ProductPage); setPhase("application"); } }, [preview]);

  if (phase === "splash") return <DeviceFrame page="splash"><Splash /></DeviceFrame>;
  if (phase === "onboarding") {
    return <DeviceFrame page="onboarding"><Onboarding initialIntent={preferences.onboardingIntent} onComplete={(intent) => {
      if (!preview) completeLegacyOnboarding(intent);
      setPhase("application");
    }} /></DeviceFrame>;
  }

  const screen = page === "conversation" ? <ConversationPage snapshot={snapshot} onNavigate={next => setPage(next as ProductPage)} /> : page === "schedule" ? <SchedulePage snapshot={snapshot} onNavigate={next => setPage(next as ProductPage)} /> : page === "path" ? <PathPage snapshot={snapshot} onNavigate={next => setPage(next as ProductPage)} /> : page === "profile" ? <ProfilePage snapshot={snapshot} onNavigate={next => setPage(next as ProductPage)} /> : <HomePage snapshot={snapshot} onNavigate={next => setPage(next as ProductPage)} />;
  return <DeviceFrame page={page === "path" ? "home" : page}>{screen}</DeviceFrame>;
}
