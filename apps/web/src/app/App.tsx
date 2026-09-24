import { useEffect, useMemo, useState, type ReactNode } from "react";
import { completeLegacyOnboarding, readLegacyOnboarding } from "../adapters/legacy-onboarding-store";
import { DeviceFrame } from "../components";
import { LegacyRuntimeProvider, useLegacyRuntime } from "../hooks/LegacyRuntimeProvider";
import styles from "./App.module.css";
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
  return <LegacyRuntimeProvider><RuntimeApplication /></LegacyRuntimeProvider>;
}

function RuntimeApplication() {
  const preview = useMemo(previewPhase, []);
  const preferences = useMemo(readLegacyOnboarding, []);
  const { runtime, snapshot, voiceState, voiceTranscript, keyboardVisible } = useLegacyRuntime();
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

  const wrapPreview = (page: "splash" | "onboarding" | "home" | "conversation" | "schedule" | "profile", content: ReactNode) => preview ? <DeviceFrame page={page}>{content}</DeviceFrame> : <div className={styles.runtimeShell}>{content}</div>;
  if (phase === "splash") return wrapPreview("splash", <Splash />);
  if (phase === "onboarding") {
    return wrapPreview("onboarding", <Onboarding initialIntent={preferences.onboardingIntent} onComplete={(intent) => {
      if (!preview) {
        completeLegacyOnboarding(intent);
        runtime?.completeOnboarding(intent);
      }
      setPhase("application");
    }} />);
  }

  const navigate = (next: string) => setPage(next as ProductPage);
  const screen = page === "conversation"
    ? <ConversationPage keyboardVisible={keyboardVisible} onNavigate={navigate} runtime={runtime} snapshot={snapshot} voiceState={voiceState} voiceTranscript={voiceTranscript} />
    : page === "schedule"
      ? <SchedulePage onNavigate={navigate} runtime={runtime} snapshot={snapshot} />
      : page === "path"
        ? <PathPage onNavigate={navigate} snapshot={snapshot} />
        : page === "profile"
          ? <ProfilePage onNavigate={navigate} runtime={runtime} snapshot={snapshot} />
          : <HomePage onNavigate={navigate} runtime={runtime} snapshot={snapshot} state={runtime ? "default" : "loading"} />;
  return wrapPreview(page === "path" ? "home" : page, screen);
}
