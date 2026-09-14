(() => {
  window.__XUECHENG_NATIVE_SHELL__ = true;
  const markNativeShell = () => document.documentElement?.classList.add("native-shell");
  if (document.documentElement) markNativeShell();
  else document.addEventListener("DOMContentLoaded", markNativeShell, { once: true });
})();
