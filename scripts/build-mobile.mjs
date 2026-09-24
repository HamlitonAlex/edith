import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps", "web");
const dist = resolve(root, "dist");
const runtime = resolve(dist, "runtime");

await build({
  configFile: resolve(web, "vite.config.ts"),
  build: {
    outDir: dist,
    emptyOutDir: true,
    assetsDir: "assets",
  },
});

await mkdir(runtime, { recursive: true });
const runtimeFiles = [
  "iphone.html",
  "iphone.css",
  "iphone-refinement.css",
  "phosphor-icons.css",
  "iphone.js",
  "native-bootstrap.js",
  "local-backup.js",
  "manifest.webmanifest",
];
await Promise.all(runtimeFiles.map(name => cp(resolve(web, name), resolve(runtime, name))));
await Promise.all([
  cp(resolve(web, "assets"), resolve(runtime, "assets"), { recursive: true }),
  cp(resolve(web, "agent"), resolve(runtime, "agent"), { recursive: true }),
  cp(resolve(web, "lib", "conversation-history.js"), resolve(runtime, "lib", "conversation-history.js")),
  cp(resolve(web, "lib", "companion-state.js"), resolve(runtime, "lib", "companion-state.js")),
  cp(resolve(web, "lib", "viewport-height.js"), resolve(runtime, "lib", "viewport-height.js")),
  cp(resolve(web, "lib", "auth-session.js"), resolve(runtime, "lib", "auth-session.js")),
  cp(resolve(web, "lib", "remote-api.js"), resolve(runtime, "lib", "remote-api.js")),
  cp(resolve(web, "lib", "explicit-sync.js"), resolve(runtime, "lib", "explicit-sync.js")),
  cp(resolve(web, "lib", "app-repository.js"), resolve(runtime, "lib", "app-repository.js")),
  cp(resolve(web, "lib", "memory-repository.js"), resolve(runtime, "lib", "memory-repository.js")),
]);

await Promise.all([
  cp(resolve(web, "assets"), resolve(dist, "assets"), { recursive: true }),
  cp(resolve(web, "sw.js"), resolve(dist, "sw.js")),
  cp(resolve(web, "manifest.webmanifest"), resolve(dist, "manifest.webmanifest")),
  cp(resolve(web, "ui-directions.html"), resolve(dist, "ui-directions.html")),
  cp(resolve(web, "ui-directions.css"), resolve(dist, "ui-directions.css")),
  cp(resolve(web, "ui-directions.js"), resolve(dist, "ui-directions.js")),
  cp(resolve(web, "companion-v3.html"), resolve(dist, "web-preview.html")),
  cp(resolve(web, "companion-v3.css"), resolve(dist, "companion-v3.css")),
  cp(resolve(web, "companion.js"), resolve(dist, "companion.js")),
]);

console.log("React app built to dist/index.html; legacy business runtime retained at dist/runtime/iphone.html.");
