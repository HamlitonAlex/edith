import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps", "web");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "assets"), { recursive: true });

await Promise.all([
  cp(resolve(web, "iphone.html"), resolve(dist, "index.html")),
  cp(resolve(web, "iphone.css"), resolve(dist, "iphone.css")),
  cp(resolve(web, "iphone.js"), resolve(dist, "iphone.js")),
  cp(resolve(web, "manifest.webmanifest"), resolve(dist, "manifest.webmanifest")),
  cp(resolve(web, "sw.js"), resolve(dist, "sw.js")),
  cp(resolve(web, "assets", "companion-default.png"), resolve(dist, "assets", "companion-default.png")),
]);

console.log("Mobile web bundle created in dist/");
