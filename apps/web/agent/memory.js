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
