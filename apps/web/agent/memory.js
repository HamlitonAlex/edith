export function rememberObservation(state, observation) {
  const next = structuredClone(state);
  next.recent_events.push({ at: observation.at, source: observation.source, text: observation.text });
  next.recent_events = next.recent_events.slice(-30);
  const kind = observation.signals.tired ? "energy" : observation.signals.busy ? "schedule" : "interaction";
  next.memory.push({ id: observation.id, kind, text: observation.text, source: "用户本次原话", confidence: 0.7, status: "observed" });
  next.memory = next.memory.slice(-60);
  next.updated_at = observation.at;
  return next;
}

export function recordActionRevision(state, previous, nextAction, reason, at) {
  state.action_history.push({ action_id: previous.id, previous, revised_to: nextAction, reason, at });
  state.action_history = state.action_history.slice(-30);
}

export function recordLearningResult(state, result) {
  const next = structuredClone(state);
  next.learning_results = [...(next.learning_results || []), result].slice(-30);
  next.current_state = {
    ...(next.current_state || {}),
    last_learning_result_at: result.at,
    last_learning_domain: result.domain,
    last_learning_topic: result.topic,
  };
  next.memory = [
    ...(next.memory || []),
    {
      id: result.id,
      kind: "learning_result",
      text: result.learned,
      source: "Tutor Mode",
      confidence: result.confidence ?? 0.86,
      status: "recorded",
      result_id: result.id,
      at: result.at,
    },
  ].slice(-60);
  return next;
}

const MAX_TUTOR_SESSIONS = 30;
const MAX_REASON_LENGTH = 160;

const tutorTotals = {
  started: 0,
  completed: 0,
  interrupted: 0,
  verification_attempts: 0,
  total_turns: 0,
  total_hints: 0,
  total_adaptations: 0,
};

function ensureTutorMetrics(state) {
  const current = state.tutor_metrics || {};
  return {
    current: current.current || null,
    history: (current.history || []).slice(-MAX_TUTOR_SESSIONS),
    totals: { ...tutorTotals, ...(current.totals || {}) },
  };
}

function safeMinutes(startedAt, endedAt) {
  const started = Date.parse(startedAt || "");
  const ended = Date.parse(endedAt || "");
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0;
  return Math.max(0, Math.round((ended - started) / 60000));
}

function compactReason(reason) {
  return String(reason || "").trim().slice(0, MAX_REASON_LENGTH);
}

function completionStatus(result) {
  if (!result) return "weak";
  if (result.mastered?.length && !result.partial?.length && !result.unmastered?.length) return "mastered";
  if (result.mastered?.length || result.partial?.length) return "partial";
  return "weak";
}

export function startTutorMetrics(state, session, observation) {
  const next = structuredClone(state);
  const metrics = ensureTutorMetrics(next);
  const at = observation.at || new Date().toISOString();
  metrics.current = {
    id: `tutor-${session.action_id}-${at.replace(/\D/g, "").slice(-14)}`,
    action_id: session.action_id,
    domain: session.domain,
    topic: session.topic,
    started_at: at,
    last_at: at,
    status: "active",
    turn_count: 0,
    hints_used: 0,
    adaptations: 0,
    verification_attempts: 0,
    last_stage: session.stage || "baseline",
    last_difficulty: session.difficulty || "normal",
    last_observation_id: null,
  };
  metrics.totals.started += 1;
  next.tutor_metrics = metrics;
  return next;
}

export function recordTutorTurn(state, session, observation) {
  const next = structuredClone(state);
  const metrics = ensureTutorMetrics(next);
  const current = metrics.current;
  if (!current) return next;
  const observationId = observation.id || observation.at;
  if (current.last_observation_id === observationId) return next;
  current.turn_count += 1;
  current.last_at = observation.at || current.last_at;
  current.hints_used = Math.max(current.hints_used, session?.hints_used || 0);
  current.adaptations = Math.max(current.adaptations, session?.adaptations || 0);
  current.last_stage = session?.stage || current.last_stage;
  current.last_difficulty = session?.difficulty || current.last_difficulty;
  current.last_observation_id = observationId;
  next.tutor_metrics = metrics;
  return next;
}

export function recordTutorVerificationAttempt(state, session, observation) {
  const next = recordTutorTurn(state, session, observation);
  const metrics = ensureTutorMetrics(next);
  const current = metrics.current;
  if (!current) return next;
  const observationId = observation.id || observation.at;
  if (current.last_verification_observation_id === observationId) return next;
  current.verification_attempts += 1;
  current.last_verification_at = observation.at || current.last_at;
  current.last_verification_observation_id = observationId;
  metrics.totals.verification_attempts += 1;
  next.tutor_metrics = metrics;
  return next;
}

export function finishTutorMetrics(state, { result, observation, status, reason } = {}) {
  const next = structuredClone(state);
  const metrics = ensureTutorMetrics(next);
  const current = metrics.current;
  if (!current) return next;
  const endedAt = observation?.at || new Date().toISOString();
  const finalStatus = status || completionStatus(result);
  const summary = {
    id: current.id,
    action_id: current.action_id,
    domain: current.domain,
    topic: current.topic,
    started_at: current.started_at,
    ended_at: endedAt,
    duration_minutes: safeMinutes(current.started_at, endedAt),
    status: finalStatus,
    turn_count: current.turn_count,
    hints_used: current.hints_used,
    adaptations: current.adaptations,
    verification_attempts: current.verification_attempts,
    last_stage: current.last_stage,
    last_difficulty: current.last_difficulty,
    ...(result?.id ? { result_id: result.id } : {}),
    ...(result?.confidence != null ? { confidence: result.confidence } : {}),
    ...(reason ? { reason: compactReason(reason) } : {}),
  };
  metrics.history = [...metrics.history, summary].slice(-MAX_TUTOR_SESSIONS);
  if (finalStatus === "interrupted") metrics.totals.interrupted += 1;
  else metrics.totals.completed += 1;
  metrics.totals.total_turns += summary.turn_count;
  metrics.totals.total_hints += summary.hints_used;
  metrics.totals.total_adaptations += summary.adaptations;
  metrics.current = null;
  next.tutor_metrics = metrics;
  return next;
}
