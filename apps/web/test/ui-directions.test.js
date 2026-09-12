import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, js, build] = await Promise.all([
  readFile(new URL("../ui-directions.html", import.meta.url), "utf8"),
  readFile(new URL("../ui-directions.css", import.meta.url), "utf8"),
  readFile(new URL("../ui-directions.js", import.meta.url), "utf8"),
  readFile(new URL("../../../scripts/build-mobile.mjs", import.meta.url), "utf8"),
]);

test("the comparison board offers five structurally distinct directions", () => {
  assert.equal((html.match(/class="direction" data-direction=/g) || []).length, 5);
  for (const direction of ["editorial", "forest", "notebook", "gallery", "collage"]) {
    assert.match(html, new RegExp(`direction-${direction}`));
    assert.match(css, new RegExp(`\\.direction-${direction}`));
  }
});

test("direction selection is local and does not mutate the production interface", () => {
  assert.match(js, /xuecheng:ui-direction-choice/);
  assert.match(js, /localStorage\.setItem/);
  assert.doesNotMatch(js, /fetch\(|window\.open|location\s*=/);
  assert.match(build, /ui-directions\.html/);
  assert.match(build, /ui-directions\.css/);
  assert.match(build, /ui-directions\.js/);
});
