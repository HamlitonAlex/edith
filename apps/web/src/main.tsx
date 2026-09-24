import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/global.css";

const root = document.getElementById("react-ui-root");

if (!root) throw new Error("React UI 根节点不存在");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (!import.meta.env.DEV && "serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js").catch(() => {}); }, { once: true });
}
