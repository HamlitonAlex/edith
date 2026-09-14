import test from "node:test";
import assert from "node:assert/strict";
import { resolveAppViewport } from "../lib/viewport-height.js";

test("keeps the app shell full-height when iOS reports a stale short visual viewport", () => {
  const result = resolveAppViewport({
    layoutHeight: 852,
    visualHeight: 393,
    layoutWidth: 393,
    focusedTextEntry: false,
    viewportBaseline: 852,
    viewportWidth: 393,
    keyboardWasOpen: false,
  });

  assert.deepEqual(result, {
    appHeight: 852,
    keyboardOpen: false,
    viewportBaseline: 852,
    viewportWidth: 393,
  });
});

test("never lets a taller visual viewport push the app shell past its layout window", () => {
  const result = resolveAppViewport({
    layoutHeight: 844,
    visualHeight: 852,
    layoutWidth: 390,
    focusedTextEntry: false,
    viewportBaseline: 844,
    viewportWidth: 390,
    keyboardWasOpen: false,
  });

  assert.deepEqual(result, {
    appHeight: 844,
    keyboardOpen: false,
    viewportBaseline: 844,
    viewportWidth: 390,
  });
});

test("uses the smaller visual viewport only while a text entry and keyboard are active", () => {
  const result = resolveAppViewport({
    layoutHeight: 852,
    visualHeight: 486,
    layoutWidth: 393,
    focusedTextEntry: true,
    viewportBaseline: 852,
    viewportWidth: 393,
    keyboardWasOpen: false,
  });

  assert.deepEqual(result, {
    appHeight: 486,
    keyboardOpen: true,
    viewportBaseline: 852,
    viewportWidth: 393,
  });
});

test("keeps the keyboard state when a resize arrives just before iOS reports focus", () => {
  const result = resolveAppViewport({
    layoutHeight: 486,
    visualHeight: 486,
    layoutWidth: 393,
    focusedTextEntry: false,
    viewportBaseline: 852,
    viewportWidth: 393,
    keyboardWasOpen: false,
  });

  assert.deepEqual(result, {
    appHeight: 486,
    keyboardOpen: true,
    viewportBaseline: 852,
    viewportWidth: 393,
  });
});

test("holds keyboard mode until the native viewport has actually recovered after blur", () => {
  const result = resolveAppViewport({
    layoutHeight: 852,
    visualHeight: 486,
    layoutWidth: 393,
    focusedTextEntry: false,
    viewportBaseline: 852,
    viewportWidth: 393,
    keyboardWasOpen: true,
  });

  assert.deepEqual(result, {
    appHeight: 486,
    keyboardOpen: true,
    viewportBaseline: 852,
    viewportWidth: 393,
  });
});

test("resets the baseline for an actual width-changing orientation transition", () => {
  const result = resolveAppViewport({
    layoutHeight: 393,
    visualHeight: 393,
    layoutWidth: 852,
    focusedTextEntry: false,
    viewportBaseline: 852,
    viewportWidth: 393,
    keyboardWasOpen: false,
  });

  assert.deepEqual(result, {
    appHeight: 393,
    keyboardOpen: false,
    viewportBaseline: 393,
    viewportWidth: 852,
  });
});
