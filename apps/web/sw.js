const CACHE = "xuecheng-iphone-v5";
const SHELL = ["./", "./iphone.css", "./iphone.js", "./manifest.webmanifest", "./assets/xuecheng-mark.svg", "./assets/xuecheng-mark.png", "./agent/index.js", "./agent/state.js", "./agent/observer.js", "./agent/memory.js", "./agent/user-model.js", "./agent/planner.js", "./agent/tutor.js", "./agent/evaluator.js", "./agent/scheduler.js", "./agent/model-gateway.js", "./agent/obsidian.js", "./agent/resource-catalog.js"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("./"))));
});
