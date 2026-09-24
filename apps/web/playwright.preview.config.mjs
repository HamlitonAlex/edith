import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./visual",
  outputDir: "../../test-results/phase-2.1",
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1200, height: 980 },
  },
  webServer: {
    command: "npm run dev:ui -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174/react.html?preview=onboarding",
    reuseExistingServer: true,
  },
});
