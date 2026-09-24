/**
 * Phase 2 bridge for the existing local-first preference document.
 *
 * The legacy application continues to own the shape and migration of this
 * record. React only reads and updates the same `onboardingComplete` flag and
 * one optional onboarding intent; it does not introduce a parallel store.
 */
const PREFERENCES_KEY = "xuecheng:iphone:v2";

export type OnboardingIntent = "exam" | "skill" | "course" | "growth";

export interface LegacyOnboardingPreferences {
  onboardingComplete: boolean;
  onboardingIntent?: OnboardingIntent;
}

function readDocument(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readLegacyOnboarding(): LegacyOnboardingPreferences {
  const preferences = readDocument();
  const intent = preferences.onboardingIntent;
  return {
    onboardingComplete: Boolean(preferences.onboardingComplete),
    onboardingIntent: intent === "exam" || intent === "skill" || intent === "course" || intent === "growth"
      ? intent
      : undefined,
  };
}

export function completeLegacyOnboarding(intent: OnboardingIntent): void {
  const preferences = readDocument();
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    ...preferences,
    onboardingComplete: true,
    onboardingIntent: intent,
  }));
}
