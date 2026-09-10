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
