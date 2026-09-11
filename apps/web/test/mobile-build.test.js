import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../../scripts/build-mobile.mjs", import.meta.url), "utf8");

test("mobile bundle carries only the browser-side library module it uses", () => {
  assert.match(source, /resolve\(web, "lib", "conversation-history\.js"\)/);
  assert.match(source, /resolve\(dist, "lib", "conversation-history\.js"\)/);
  assert.doesNotMatch(source, /cp\(resolve\(web, "lib"\), resolve\(dist, "lib"\)/);
});
