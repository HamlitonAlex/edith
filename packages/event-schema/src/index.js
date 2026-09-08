export const EVENT_KINDS = Object.freeze([
  "plan",
  "behavior",
  "self_report",
  "artifact",
  "inference",
]);

const VISIBILITY = new Set(["private", "shared", "guardian"]);
const INFERENCE_STATUS = new Set(["pending", "confirmed", "rejected"]);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isTimestamp = (value) =>
  isNonEmptyString(value) && !Number.isNaN(Date.parse(value));

export function validateEvent(event) {
  const errors = [];

  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return { valid: false, errors: ["event must be an object"] };
  }

  if (!isNonEmptyString(event.event_id)) {
    errors.push("event_id must be a non-empty string");
  }
  if (!isTimestamp(event.occurred_at)) {
    errors.push("occurred_at must be an ISO-8601 timestamp");
  }
  if (
    !event.source ||
    typeof event.source !== "object" ||
    !isNonEmptyString(event.source.type) ||
    !isNonEmptyString(event.source.name)
  ) {
    errors.push("source must include non-empty type and name");
  }
  if (!isNonEmptyString(event.actor)) {
    errors.push("actor must be a non-empty string");
  }
  if (!EVENT_KINDS.includes(event.kind)) {
    errors.push("kind must be a supported event kind");
  }
  if (!event.content || typeof event.content !== "object" || Array.isArray(event.content)) {
    errors.push("content must be an object");
  }
  if (!VISIBILITY.has(event.visibility)) {
    errors.push("visibility must be private, shared, or guardian");
  }
  if (!isNonEmptyString(event.consent_scope)) {
    errors.push("consent_scope must be a non-empty string");
  }
  if (event.kind === "inference" && !INFERENCE_STATUS.has(event.inference_status)) {
    errors.push(
      "inference_status must be pending, confirmed, or rejected for inference events",
    );
  }

  return { valid: errors.length === 0, errors };
}

export function sortEvents(events) {
  return [...events].sort(
    (left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at),
  );
}

export function applyInferenceDecision(events, eventId, decision) {
  if (!new Set(["confirmed", "rejected"]).has(decision)) {
    throw new Error("Decision must be confirmed or rejected");
  }

  const index = events.findIndex((event) => event.event_id === eventId);
  if (index === -1) {
    throw new Error(`Event ${eventId} was not found`);
  }
  if (events[index].kind !== "inference") {
    throw new Error("Only inference events can receive a decision");
  }

  return events.map((event) =>
    event.event_id === eventId
      ? { ...event, inference_status: decision }
      : { ...event },
  );
}
