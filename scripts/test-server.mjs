import assert from "node:assert/strict";
import { createStaticServer } from "./serve.mjs";
const server=createStaticServer();
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
try{
 const origin=`http://127.0.0.1:${server.address().port}`;
 const [home,styles,avatar,manifest,legacy,module,agent,traversal]=await Promise.all([
  fetch(`${origin}/`),fetch(`${origin}/iphone.css`),fetch(`${origin}/assets/companion-default.png`),
  fetch(`${origin}/manifest.webmanifest`),fetch(`${origin}/web-preview`),fetch(`${origin}/packages/event-schema/src/index.js`),
  fetch(`${origin}/agent/index.js`),fetch(`${origin}/%2e%2e%2fpackage.json`)
 ]);
 assert.equal(home.status,200);assert.match(home.headers.get("content-type"),/text\/html/);assert.match(await home.text(),/学程 iPhone 原型/);
 assert.equal(styles.status,200);assert.match(styles.headers.get("content-type"),/text\/css/);await styles.text();
 assert.equal(avatar.status,200);assert.equal(avatar.headers.get("content-type"),"image/png");await avatar.arrayBuffer();
 assert.equal(manifest.status,200);assert.match(manifest.headers.get("content-type"),/manifest/);await manifest.text();
 assert.equal(legacy.status,200);assert.match(await legacy.text(),/把今天过具体一点/);
 assert.equal(module.status,200);assert.match(await module.text(),/EVENT_KINDS/);
 assert.equal(agent.status,200);assert.match(await agent.text(),/runAgentTurn/);
 assert.equal(traversal.status,403);console.log("server smoke test passed");
}finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
