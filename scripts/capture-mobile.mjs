import { writeFile } from "node:fs/promises";

const [, , endpoint = "http://127.0.0.1:9224", output = "artifacts/ui-mobile-cdp.png", widthArg = "390", heightArg = "844", pageUrl = "http://127.0.0.1:4173/"] = process.argv;
const width = Number(widthArg);
const height = Number(heightArg);
const page = await fetch(`${endpoint}/json/new?${encodeURIComponent(pageUrl)}`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();

socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: width,
  screenHeight: height,
});
await send("Page.enable");
await send("Page.navigate", { url: pageUrl });
await new Promise((resolve) => setTimeout(resolve, 700));
const metrics = await send("Runtime.evaluate", {
  expression: "JSON.stringify({width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth})",
  returnByValue: true,
});
const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
  fromSurface: true,
});
await writeFile(output, Buffer.from(screenshot.data, "base64"));
console.log(metrics.result.value);
socket.close();
