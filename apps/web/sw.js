const CACHE = "xuecheng-react-v27";
const SHELL = ["./", "./index.html", "./react.html", "./runtime/iphone.html", "./runtime/iphone.css", "./runtime/iphone-refinement.css", "./runtime/phosphor-icons.css", "./runtime/iphone.js", "./runtime/native-bootstrap.js", "./runtime/local-backup.js", "./runtime/manifest.webmanifest", "./runtime/assets/phosphor/regular.woff2", "./runtime/assets/xuecheng-mark.svg", "./runtime/assets/xuecheng-mark.png", "./runtime/assets/brand/xuecheng-launch-mist.png", "./runtime/assets/brand/xuecheng-task-mist.png", "./runtime/assets/brand/xuecheng-voice-mist.png", "./runtime/lib/conversation-history.js", "./runtime/lib/auth-session.js", "./runtime/lib/remote-api.js", "./runtime/lib/explicit-sync.js", "./runtime/lib/app-repository.js", "./runtime/agent/index.js", "./runtime/agent/state.js", "./runtime/agent/observer.js", "./runtime/agent/memory.js", "./runtime/agent/user-model.js", "./runtime/agent/planner.js", "./runtime/agent/tutor.js", "./runtime/agent/evaluator.js", "./runtime/agent/scheduler.js", "./runtime/agent/model-gateway.js", "./runtime/agent/model-providers.js", "./runtime/agent/obsidian.js", "./runtime/agent/resource-catalog.js"];
self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  for (const page of ["./index.html", "./react.html"]) {
    const response = await cache.match(page);
    if (!response) continue;
    const html = await response.text();
    const refs = [...html.matchAll(/(?:src|href)=[\"']([^\"']+)[\"']/g)].map(match => new URL(match[1], self.location.href).pathname).filter(path => path.startsWith("/assets/"));
    await Promise.all(refs.map(path => cache.add(path).catch(() => {})));
  }
})()));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("./"))));
});
