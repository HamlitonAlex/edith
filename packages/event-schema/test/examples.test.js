import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateEvent } from "../src/index.js";

test("all documented event examples satisfy the shared protocol", async () => {
  const examplesDirectory = resolve("examples", "events");
  const files = (await readdir(examplesDirectory)).filter((file) => file.endsWith(".json"));
  assert.ok(files.length >= 3);

  for (const file of files) {
    const payload = JSON.parse(await readFile(resolve(examplesDirectory, file), "utf8"));
    const result = validateEvent(payload);
    assert.equal(result.valid, true, `${file}: ${result.errors.join(", ")}`);
  }
});
