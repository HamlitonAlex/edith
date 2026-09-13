import test from "node:test";
import assert from "node:assert/strict";
import { resolveAppViewport } from "../lib/viewport-height.js";

test("keeps the app shell full-height when iOS reports a stale short visual viewport", () => {
  const result = resolveAppViewport({
    layoutHeight: 852,
    visualHeight: 393,
    focusedTextEntry: false,
    viewportBaseline: 852,
  });

  assert.deepEqual(result, {
    appHeight: 852,
    keyboardOpen: false,
    viewportBaseline: 852,
  });
});

test("never lets a taller visual viewport push the app shell past its layout window", () => {
  const result = resolveAppViewport({
    layoutHeight: 844,
    visualHeight: 852,
    focusedTextEntry: false,
    viewportBaseline: 844,
  });

  assert.deepEqual(result, {
    appHeight: 844,
    keyboardOpen: false,
    viewportBaseline: 844,
  });
});

test("uses the smaller visual viewport only while a text entry and keyboard are active", () => {
  const result = resolveAppViewport({
    layoutHeight: 852,
    visualHeight: 486,
    focusedTextEntry: true,
    viewportBaseline: 852,
  });

  assert.deepEqual(result, {
    appHeight: 486,
    keyboardOpen: true,
    viewportBaseline: 852,
  });
});
