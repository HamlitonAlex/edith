function assertAdjustment(adjustment) {
  if (
    !adjustment ||
    typeof adjustment.id !== "string" ||
    typeof adjustment.reason !== "string" ||
    !Array.isArray(adjustment.replaceActions)
  ) {
    throw new Error("Adjustment requires id, reason, and replaceActions");
  }
}

function decisionEntry(adjustment, decision, decidedAt) {
  return {
    adjustment_id: adjustment.id,
    decision,
    reason: adjustment.reason,
    changed_actions: [...adjustment.replaceActions],
    decided_at: decidedAt,
  };
}

export function adoptAdjustment(plan, adjustment, decidedAt = new Date().toISOString()) {
  assertAdjustment(adjustment);
  return {
    ...plan,
    version: plan.version + 1,
    currentActions: [...adjustment.replaceActions],
    history: [
      ...plan.history,
      decisionEntry(adjustment, "adopted", decidedAt),
    ],
  };
}

export function rejectAdjustment(plan, adjustment, decidedAt = new Date().toISOString()) {
  assertAdjustment(adjustment);
  return {
    ...plan,
    currentActions: [...plan.currentActions],
    history: [
      ...plan.history,
      decisionEntry(adjustment, "rejected", decidedAt),
    ],
  };
}
