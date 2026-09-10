import test from "node:test";
import assert from "node:assert/strict";
import { GENERAL_KNOWLEDGE_RESOURCES, canRecommendResource, findResourceCandidates } from "../agent/resource-catalog.js";

test("user-supplied creator list keeps provenance and verification boundary", () => {
  assert.equal(GENERAL_KNOWLEDGE_RESOURCES.length, 42);
  assert.ok(GENERAL_KNOWLEDGE_RESOURCES.every(item => item.source.includes("用户提供")));
  assert.ok(GENERAL_KNOWLEDGE_RESOURCES.every(item => item.requires_verification));
});

test("resource candidates respect topic, age, tone and platform", () => {
  const results = findResourceCandidates({ topic: "中国史", age: 8, tone: "playful", platform: "bilibili" });
  assert.ok(results.some(item => item.name === "如果历史是一群喵"));
  assert.ok(results.every(item => item.min_age <= 8 && item.tone === "playful" && item.platform === "bilibili"));
});

test("a catalog mention cannot become a recommendation before content verification", () => {
  const candidate = findResourceCandidates({ topic: "地理", age: 10 })[0];
  assert.equal(canRecommendResource(candidate), false);
  assert.equal(canRecommendResource({ ...candidate, verification_status: "verified", url: "https://example.com", content_scope: "0-10 分钟" }), true);
});

test("the catalog distinguishes searchable series from creators", () => {
  assert.equal(GENERAL_KNOWLEDGE_RESOURCES.find(item => item.name === "汉字五千年")?.kind, "series");
});
