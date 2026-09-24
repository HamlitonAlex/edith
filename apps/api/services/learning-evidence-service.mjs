import { ApiError } from "../lib/http.mjs";

const EVIDENCE_TYPES = new Set([
  "exercise_completed",
  "correct_answer",
  "wrong_answer",
  "incorrect_answer",
  "practice_completed",
  "tutor_verification",
  "tutor_observation",
  "self_assessment",
  "user_self_report",
  "project_completed",
  "exam_result",
  "assessment",
  "explanation",
  "independent_solution",
  "transfer",
  "correction",
]);
const SOURCE_TYPES = new Set(["exercise", "tutor", "project", "exam", "user", "manual"]);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,127}$/;
const SOURCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;
const isObject = value => value && typeof value === "object" && !Array.isArray(value);

function text(value, maximum, field) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_learning_evidence", `${field} 格式不正确。`);
  }
  return value.trim();
}

function ratio(value, field, fallback = 0.5) {
  if (value == null && fallback != null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new ApiError(422, "invalid_learning_evidence", `${field} 必须是 0 到 1 之间的数值。`);
  }
  return number;
}

function opaqueSourceId(value) {
  if (value == null) return null;
  const sourceId = text(value, 160, "source_id");
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    throw new ApiError(422, "invalid_learning_evidence_source", "source_id 必须是来源记录的短标识，不能包含原始聊天内容。 ");
  }
  return sourceId;
}

export function normalizeEvidenceId(value, field = "evidence_id") {
  const id = decodeURIComponent(String(value || ""));
  if (!ID_PATTERN.test(id)) throw new ApiError(422, "invalid_learning_evidence_identifier", `${field} 格式不正确。`);
  return id;
}

export function normalizeEvidenceInput(payload) {
  if (!isObject(payload)) throw new ApiError(422, "invalid_learning_evidence", "学习证据必须是对象。 ");
  if (payload.id == null) throw new ApiError(422, "learning_evidence_id_required", "创建学习证据需要稳定的客户端标识。 ");
  const id = normalizeEvidenceId(payload.id);
  const topic = text(payload.topic, 180, "topic");
  const skill = text(payload.skill, 180, "skill");
  const evidenceType = text(payload.evidence_type, 48, "evidence_type");
  if (!EVIDENCE_TYPES.has(evidenceType)) throw new ApiError(422, "invalid_learning_evidence", "evidence_type 无效。 ");
  const sourceType = text(payload.source_type, 40, "source_type");
  if (!SOURCE_TYPES.has(sourceType)) throw new ApiError(422, "invalid_learning_evidence", "source_type 无效。 ");
  if (sourceType === "user" && !["self_assessment", "user_self_report"].includes(evidenceType)) {
    throw new ApiError(422, "invalid_learning_evidence", "用户自评只能使用 self_assessment 类型。 ");
  }
  const sourceId = opaqueSourceId(payload.source_id);
  const score = payload.score == null ? null : Number(payload.score);
  if (score != null && (!Number.isFinite(score) || score < 0 || score > 100)) {
    throw new ApiError(422, "invalid_learning_evidence", "score 必须是 0 到 100 之间的数值。 ");
  }
  return {
    id,
    topic,
    skill,
    evidence_type: evidenceType,
    result: text(payload.result, 2000, "result"),
    score,
    source_type: sourceType,
    source_id: sourceId,
    confidence: ratio(payload.confidence, "confidence"),
  };
}

export function normalizeEvidenceFilters(searchParams) {
  const topic = searchParams.get("topic");
  const skill = searchParams.get("skill");
  const evidenceType = String(searchParams.get("evidence_type") || "").trim();
  if (evidenceType && !EVIDENCE_TYPES.has(evidenceType)) throw new ApiError(422, "invalid_learning_evidence_filter", "evidence_type 无效。 ");
  const sourceType = String(searchParams.get("source_type") || "").trim();
  if (sourceType && !SOURCE_TYPES.has(sourceType)) throw new ApiError(422, "invalid_learning_evidence_filter", "source_type 无效。 ");
  const limit = Number(searchParams.get("limit") || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(422, "invalid_page", "limit 必须是 1 到 100 的整数。 ");
  return {
    topic: topic == null || topic === "" ? null : text(topic, 180, "topic"),
    skill: skill == null || skill === "" ? null : text(skill, 180, "skill"),
    evidence_type: evidenceType || null,
    source_type: sourceType || null,
    limit,
  };
}

export function evidenceResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    topic: row.topic,
    skill: row.skill,
    evidence_type: row.evidence_type,
    result: row.result,
    score: row.score == null ? null : Number(row.score),
    source_type: row.source_type,
    source_id: row.source_id || null,
    confidence: Number(row.confidence),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export { EVIDENCE_TYPES, SOURCE_TYPES };
