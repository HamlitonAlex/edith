const validHeight = value => {
  const height = Math.round(Number(value));
  return Number.isFinite(height) && height > 0 ? height : 0;
};

/**
 * iOS can transiently report a visual viewport from the prior orientation.
 * Keep the application shell tied to the stable layout viewport until an
 * actual focused text entry proves that the keyboard is taking space.
 */
export function resolveAppViewport({
  layoutHeight,
  visualHeight,
  layoutWidth,
  focusedTextEntry,
  viewportBaseline,
  viewportWidth,
  keyboardWasOpen = false,
}) {
  const layout = validHeight(layoutHeight);
  const visual = validHeight(visualHeight) || layout;
  const width = validHeight(layoutWidth);
  const previousWidth = validHeight(viewportWidth);
  const orientationChanged = Boolean(width && previousWidth && Math.abs(width - previousWidth) > 80);
  const currentHeight = layout || visual;
  const baseline = orientationChanged
    ? currentHeight
    : Math.max(validHeight(viewportBaseline), currentHeight);
  const layoutShrunk = Boolean(layout && layout < baseline - 80);
  const visualShrunk = Boolean(visual && visual < baseline - 80);
  // A resize can arrive just before iOS emits focusin. A layout viewport that
  // has already shortened is therefore treated as an active keyboard session;
  // this prevents the tab bar from flashing in the middle of the app.
  const keyboardOpen = !orientationChanged && Boolean(
    layoutShrunk || (visualShrunk && (focusedTextEntry || keyboardWasOpen))
  );
  const appHeight = keyboardOpen ? Math.min(layout || visual, visual || layout) : currentHeight;

  return {
    appHeight,
    keyboardOpen,
    viewportBaseline: baseline,
    viewportWidth: width || previousWidth,
  };
}
