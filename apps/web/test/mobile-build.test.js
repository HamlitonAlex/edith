import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../scripts/build-mobile.mjs", import.meta.url), "utf8");

test("mobile bundle builds React as the entry and isolates the legacy browser runtime", () => {
  assert.match(source, /outDir: dist/);
  assert.match(source, /const runtime = resolve\(dist, "runtime"\)/);
  assert.match(source, /"iphone.html"/);
  assert.match(source, /"iphone.js"/);
  assert.match(source, /runtimeFiles\.map\(name => cp\(resolve\(web, name\), resolve\(runtime, name\)\)\)/);
  assert.match(source, /resolve\(web, "lib", "conversation-history\.js"\)/);
  assert.match(source, /resolve\(runtime, "lib", "conversation-history\.js"\)/);
  assert.match(source, /resolve\(web, "lib", "viewport-height\.js"\)/);
  assert.match(source, /resolve\(runtime, "lib", "viewport-height\.js"\)/);
  assert.doesNotMatch(source, /cp\(resolve\(web, "lib"\), resolve\(dist, "lib"\)/);
});
