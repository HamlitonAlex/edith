import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const webRoot = fileURLToPath(new URL("./", import.meta.url));
const outputDirectory = fileURLToPath(new URL("../../.vite/react-ui", import.meta.url));

// This is intentionally a parallel UI entry during migration. Capacitor keeps
// using the existing web build until a later phase has visual and behavior parity.
export default defineConfig({
  root: webRoot,
  plugins: [react()],
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./react.html", import.meta.url)),
    },
  },
});
