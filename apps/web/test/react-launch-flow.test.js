import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("React launch flow keeps Splash and Onboarding as separate states", async () => {
  const app = await source("app/App.tsx");
  const splash = await source("pages/Splash/Splash.tsx");
  const onboarding = await source("pages/Onboarding/Onboarding.tsx");

  assert.match(app, /type ApplicationPhase = "splash" \| "onboarding" \| "application"/);
  assert.match(app, /<HomePage onNavigate=\{navigate\} runtime=\{runtime\} snapshot=\{snapshot\}/);
  assert.match(splash, /Pixso Frame3382/);
  assert.match(onboarding, /Pixso Frame3419/);
});

test("React onboarding reuses the existing local-first preference document", async () => {
  const adapter = await source("adapters/legacy-onboarding-store.ts");
  assert.match(adapter, /xuecheng:iphone:v2/);
  assert.match(adapter, /onboardingComplete: true/);
  assert.doesNotMatch(adapter, /sessionStorage|indexedDB|fetch\(/);
});

test("Phase 2 screens are viewport sized and avoid a fixed tall minimum", async () => {
  const splashCss = await source("pages/Splash/Splash.module.css");
  const onboardingCss = await source("pages/Onboarding/Onboarding.module.css");
  const frameCss = await source("components/DeviceFrame/DeviceFrame.module.css");
  assert.match(splashCss, /height: 100%/);
  assert.match(onboardingCss, /height: 100%/);
  assert.match(frameCss, /width: min\(390px, 100vw\)/);
  assert.match(frameCss, /height: min\(844px, 100dvh\)/);
  assert.match(frameCss, /border-radius: 40px/);
  assert.doesNotMatch(splashCss, /min-height:\s*6\d\dpx/);
});
