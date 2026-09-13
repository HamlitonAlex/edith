const validHeight = value => {
  const height = Math.round(Number(value));
  return Number.isFinite(height) && height > 0 ? height : 0;
};

/**
 * iOS can transiently report a visual viewport from the prior orientation.
 * Keep the application shell tied to the stable layout viewport until an
 * actual focused text entry proves that the keyboard is taking space.
 */
export function resolveAppViewport({ layoutHeight, visualHeight, focusedTextEntry, viewportBaseline }) {
  const layout = validHeight(layoutHeight);
  const visual = validHeight(visualHeight) || layout;
  // `innerHeight` is the layout viewport and is the only safe shell height
  // when no text field owns the visual viewport. In particular, do not let a
  // temporarily taller or stale `visualViewport.height` move the app beyond
  // its native window.
  const stableShellHeight = layout || visual;
  const nextBaseline = focusedTextEntry
    ? Math.max(validHeight(viewportBaseline), stableShellHeight)
    : stableShellHeight;
  const keyboardOpen = Boolean(focusedTextEntry && visual < nextBaseline - 80);

  return {
    appHeight: keyboardOpen ? visual : stableShellHeight,
    keyboardOpen,
    viewportBaseline: nextBaseline,
  };
}
