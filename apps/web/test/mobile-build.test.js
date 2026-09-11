import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../scripts/build-mobile.mjs", import.meta.url), "utf8");

test("mobile bundle carries browser-side library modules", () => {
  assert.match(source, /resolve\(web, "lib"\)/);
  assert.match(source, /resolve\(dist, "lib"\)/);
});
