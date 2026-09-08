import test from "node:test";
import assert from "node:assert/strict";

import {
  EVENT_KINDS,
  applyInferenceDecision,
  sortEvents,
  validateEvent,
} from "../src/index.js";

const baseEvent = {
  event_id: "event-1",
  occurred_at: "2026-09-05T09:00:00+08:00",
  source: { type: "calendar", name: "家庭日历" },
  actor: "parent",
  kind: "plan",
  content: { summary: "计划进行英语活动" },
  visibility: "shared",
  consent_scope: "calendar.read",
};

test("accepts each supported event kind", () => {
  assert.deepEqual(EVENT_KINDS, [
    "plan",
    "behavior",
    "self_report",
    "artifact",
    "inference",
  ]);

  for (const kind of EVENT_KINDS) {
    const event = {
      ...baseEvent,
      event_id: `event-${kind}`,
      kind,
      ...(kind === "inference" ? { inference_status: "pending" } : {}),
    };
    assert.equal(validateEvent(event).valid, true, kind);
  }
});

test("returns actionable errors for missing and invalid fields", () => {
  const result = validateEvent({
    ...baseEvent,
    event_id: "",
    occurred_at: "not-a-time",
    kind: "opinion",
    visibility: "everyone",
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("event_id must be a non-empty string"));
  assert.ok(result.errors.includes("occurred_at must be an ISO-8601 timestamp"));
  assert.ok(result.errors.includes("kind must be a supported event kind"));
  assert.ok(result.errors.includes("visibility must be private, shared, or guardian"));
});

test("requires inference status only for inference records", () => {
  const result = validateEvent({ ...baseEvent, kind: "inference" });
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes(
      "inference_status must be pending, confirmed, or rejected for inference events",
    ),
  );
});

test("sorts events chronologically without mutating input", () => {
  const late = { ...baseEvent, event_id: "late", occurred_at: "2026-09-05T18:00:00+08:00" };
  const early = { ...baseEvent, event_id: "early", occurred_at: "2026-09-05T08:00:00+08:00" };
  const input = [late, early];
  const sorted = sortEvents(input);

  assert.deepEqual(sorted.map((event) => event.event_id), ["early", "late"]);
  assert.deepEqual(input.map((event) => event.event_id), ["late", "early"]);
});

test("confirms or rejects only inference records immutably", () => {
  const inference = {
    ...baseEvent,
    event_id: "inference-1",
    kind: "inference",
    inference_status: "pending",
  };
  const events = [baseEvent, inference];
  const confirmed = applyInferenceDecision(events, "inference-1", "confirmed");

  assert.equal(confirmed[1].inference_status, "confirmed");
  assert.equal(events[1].inference_status, "pending");
  assert.throws(
    () => applyInferenceDecision(events, "event-1", "confirmed"),
    /Only inference events can receive a decision/,
  );
  assert.throws(
    () => applyInferenceDecision(events, "inference-1", "maybe"),
    /Decision must be confirmed or rejected/,
  );
});
