import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(projectRoot, "apps", "web");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function safeResolve(root, relativePath) {
  const target = resolve(root, `.${sep}${normalize(relativePath)}`);
  const rootPrefix = `${resolve(root)}${sep}`;
  return target === resolve(root) || target.startsWith(rootPrefix) ? target : null;
}

function routePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { status: 400 };
  }

  if (decoded.split(/[\\/]+/).includes("..") || isAbsolute(decoded.slice(1))) {
    return { status: 403 };
  }

  if (decoded === "/") return { root: webRoot, relative: "iphone.html" };
  if (decoded === "/web-preview") return { root: webRoot, relative: "companion-v3.html" };
  if (decoded === "/planner") return { root: webRoot, relative: "planner.html" };
  if (decoded === "/prototype") return { root: webRoot, relative: "index.html" };
  if (["/app.js", "/styles.css", "/planner.js", "/planner.css", "/companion.js", "/companion.css", "/companion-v2.css", "/companion-v3.css", "/iphone.js", "/local-backup.js", "/iphone.css", "/iphone-refinement.css", "/manifest.webmanifest", "/sw.js"].includes(decoded)) {
    return { root: webRoot, relative: decoded.slice(1) };
  }
  if (decoded.startsWith("/data/") || decoded.startsWith("/lib/") || decoded.startsWith("/assets/") || decoded.startsWith("/agent/")) {
    return { root: webRoot, relative: decoded.slice(1) };
  }
  if (decoded.startsWith("/packages/event-schema/")) {
    return { root: projectRoot, relative: decoded.slice(1) };
  }
  return { status: 404 };
}

async function handleRequest(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const route = routePath(url.pathname);
  if (route.status) {
    response.writeHead(route.status, { "content-type": "text/plain; charset=utf-8" });
    response.end(route.status === 403 ? "Forbidden" : "Not found");
    return;
  }

  const filePath = safeResolve(route.root, route.relative);
  if (!filePath) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": fileStat.size,
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

export function createStaticServer() {
  return createServer((request, response) => {
    handleRequest(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("Internal server error");
    });
  });
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const port = Number.parseInt(process.env.PORT || "4173", 10);
  const server = createStaticServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`学程原型已启动：http://localhost:${port}`);
  });
}
