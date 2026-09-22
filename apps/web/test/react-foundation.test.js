import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = relative => readFile(new URL(`../src/${relative}`, import.meta.url), "utf8");

test("React foundation keeps Pixso tokens and UI-only repository boundary", async () => {
  const [tokens, adapter, components, entry] = await Promise.all([
    source("styles/tokens.css"),
    source("adapters/repository-adapter.ts"),
    source("components/index.ts"),
    source("main.tsx"),
  ]);

  [
    "--color-background",
    "--color-surface",
    "--color-primary-text",
    "--color-secondary-text",
    "--color-primary-green",
    "--color-mist-green",
    "--color-terracotta",
    "--color-border",
    "--radius-card: 24px",
    "--radius-input: 36px",
  ].forEach(token => assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

  assert.match(adapter, /\.\.\/\.\.\/lib\/app-repository\.js/);
  assert.doesNotMatch(adapter, /fetch\(|localStorage|sessionStorage/);
  assert.match(components, /GlassCard/);
  assert.match(components, /BottomNav/);
  assert.match(components, /ListRow/);
  assert.match(entry, /createRoot/);
});
