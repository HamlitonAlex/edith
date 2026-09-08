import {
  applyInferenceDecision,
  sortEvents,
  validateEvent,
} from "/packages/event-schema/src/index.js";
import { scenarios } from "/data/scenarios.js";
import { adoptAdjustment, rejectAdjustment } from "/lib/plan-state.js";
import { interpretCapture } from "/lib/capture-response.js";

const kindLabels = {
  plan: "计划",
  behavior: "行为信号",
  self_report: "人的陈述",
  artifact: "作品证据",
  inference: "系统推测",
};

const statusLabels = {
  pending: "等待确认",
  confirmed: "已确认",
  rejected: "已否定",
};

const elements = Object.fromEntries(
  [
    "scenario-mode",
    "scenario-title",
    "scenario-summary",
    "scenario-date",
    "scenario-people",
    "scenario-level",
    "scenario-switcher",
    "validation-errors",
    "timeline",
    "inference-panel",
    "plan-version",
    "plan-direction",
    "plan-constraint",
    "stage-path",
    "current-actions",
    "adjustment-panel",
    "reset-demo",
    "status-announcer",
    "capture-form",
    "capture-input",
    "capture-voice",
    "capture-reply",
    "daily-decision-count",
  ].map((id) => [id, document.getElementById(id)]),
);

let currentScenarioId = scenarios[0].id;
let state = loadScenarioState(currentScenarioId);

function clone(value) {
  return structuredClone(value);
}

function storageKey(scenarioId) {
  return `xuecheng-demo-v1:${scenarioId}`;
}

function getScenario(scenarioId) {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  return scenario;
}

function initialState(scenarioId) {
  const scenario = getScenario(scenarioId);
  return {
    events: clone(scenario.events),
    plan: clone(scenario.plan),
    adjustmentDecision: null,
  };
}

function loadScenarioState(scenarioId) {
  try {
    const saved = localStorage.getItem(storageKey(scenarioId));
    return saved ? JSON.parse(saved) : initialState(scenarioId);
  } catch {
    return initialState(scenarioId);
  }
}

function persistState() {
  try {
    localStorage.setItem(storageKey(currentScenarioId), JSON.stringify(state));
  } catch {
    announce("浏览器未允许保存；本次操作只在当前页面有效。");
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function announce(message) {
  elements["status-announcer"].textContent = "";
  window.setTimeout(() => {
    elements["status-announcer"].textContent = message;
  }, 20);
}

function showCaptureReply(message) {
  elements["capture-reply"].hidden = false;
  elements["capture-reply"].innerHTML = `<strong>助手</strong>${escapeHtml(message)}`;
}

function handleCapture(rawText) {
  const text = String(rawText || "").trim();
  const interpretation = interpretCapture(text);

  if (!text) {
    showCaptureReply(interpretation.reply);
    elements["capture-input"].focus();
    return;
  }

  const event = {
    event_id: `manual-${Date.now()}`,
    occurred_at: new Date().toISOString(),
    source: {
      type: "browser_capture",
      name: "日常说话入口",
      detail: "用户在本地演示中主动输入或说出。",
    },
    actor: interpretation.actor,
    kind: interpretation.kind,
    content: {
      summary: `“${text}”`,
      detail: interpretation.reply,
    },
    visibility: interpretation.visibility,
    consent_scope: "explicit.browser.capture",
    ...(interpretation.goalHint ? { goal_hint: interpretation.goalHint } : {}),
  };

  const validation = validateEvent(event);
  if (!validation.valid) {
    showCaptureReply("这句话暂时没有保存成功，你可以再说一次。");
    return;
  }

  state.events = [...state.events, event];
  persistState();
  renderTimeline(state.events.filter((item) => validateEvent(item).valid));
  renderInference();
  showCaptureReply(interpretation.reply);
  elements["capture-input"].value = "";
  announce("这句话已经放进今天的生活流");
}

function renderSwitcher() {
  elements["scenario-switcher"].innerHTML = scenarios
    .map(
      (scenario) => `
        <button
          class="scenario-button"
          type="button"
          data-scenario="${escapeHtml(scenario.id)}"
          aria-pressed="${scenario.id === currentScenarioId}"
        >${escapeHtml(scenario.mode)}</button>
      `,
    )
    .join("");

  for (const button of elements["scenario-switcher"].querySelectorAll("button")) {
    button.addEventListener("click", () => {
      currentScenarioId = button.dataset.scenario;
      state = loadScenarioState(currentScenarioId);
      elements["capture-reply"].hidden = true;
      elements["capture-reply"].innerHTML = "";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      announce(`已切换到${getScenario(currentScenarioId).mode}`);
    });
  }
}

function renderHero(scenario) {
  elements["scenario-mode"].textContent = `${scenario.mode} / LIVE TRACE`;
  elements["scenario-title"].textContent = scenario.title;
  elements["scenario-summary"].textContent = scenario.summary;
  elements["scenario-date"].textContent = scenario.dateLabel;
  elements["scenario-people"].textContent = scenario.people;
  elements["scenario-level"].textContent = `主动性 ${scenario.collectionLevel}`;
}

function validateEvents(events) {
  return events.flatMap((event) => {
    const result = validateEvent(event);
    return result.valid
      ? []
      : result.errors.map((error) => `${event.event_id || "未知事件"}：${error}`);
  });
}

function renderValidation(errors) {
  const panel = elements["validation-errors"];
  if (!errors.length) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `<strong>有 ${errors.length} 条数据没有进入时间线：</strong><ul>${errors
    .map((error) => `<li>${escapeHtml(error)}</li>`)
    .join("")}</ul>`;
}

function renderTimeline(events) {
  elements.timeline.innerHTML = sortEvents(events)
    .map(
      (event, index) => `
        <li class="timeline-item" data-kind="${escapeHtml(event.kind)}" style="animation-delay:${index * 55}ms">
          <time class="timeline-time" datetime="${escapeHtml(event.occurred_at)}">${formatTime(event.occurred_at)}</time>
          <article>
            <div class="event-topline">
              <span class="event-kind" data-kind="${escapeHtml(event.kind)}">${kindLabels[event.kind] || "其他记录"}</span>
              <span class="event-source">${escapeHtml(event.source.name)}</span>
              ${
                event.kind === "inference"
                  ? `<span class="event-status" data-status="${escapeHtml(event.inference_status)}">${statusLabels[event.inference_status] || "状态未知"}</span>`
                  : ""
              }
            </div>
            <p class="event-summary">${escapeHtml(event.content.summary)}</p>
            <details class="source-details">
              <summary>为什么知道</summary>
              <p>${escapeHtml(event.content.detail || "没有补充说明。")}<br />来源：${escapeHtml(event.source.detail || event.source.name)}<br />可见范围：${escapeHtml(event.visibility)} · 授权：${escapeHtml(event.consent_scope)}</p>
            </details>
          </article>
        </li>
      `,
    )
    .join("");
}

function renderInference() {
  const pendingCount = state.events.filter(
    (event) => event.kind === "inference" && event.inference_status === "pending",
  ).length;
  elements["daily-decision-count"].textContent = String(pendingCount);

  const inference = state.events.find((event) => event.kind === "inference");
  if (!inference) {
    elements["inference-panel"].innerHTML = `
      <p class="kicker">没有系统推测</p>
      <h3 id="inference-title">目前只保存了来源记录</h3>
      <p>当多条信息形成值得检查的关联时，这里才会请求确认。</p>
    `;
    return;
  }

  if (inference.inference_status !== "pending") {
    const confirmed = inference.inference_status === "confirmed";
    elements["inference-panel"].innerHTML = `
      <p class="kicker">你的决定已经记下</p>
      <h3 id="inference-title">${confirmed ? "这项推测可以暂时用于调整" : "这项推测不会进入事实记录"}</h3>
      <div class="decision-note">
        <span class="decision-mark" aria-hidden="true">${confirmed ? "✓" : "×"}</span>
        <p>${escapeHtml(inference.content.summary)}。${confirmed ? "后续作品仍可推翻它。" : "原始事件继续保留，系统会等待新的解释。"}</p>
      </div>
    `;
    return;
  }

  elements["inference-panel"].innerHTML = `
    <p class="kicker">需要你确认 · 1 项</p>
    <h3 id="inference-title">${escapeHtml(inference.content.summary)}</h3>
    <p>${escapeHtml(inference.content.detail)}</p>
    <div class="button-row">
      <button type="button" class="primary-button" data-inference-decision="confirmed">这符合实际</button>
      <button type="button" class="secondary-button" data-inference-decision="rejected">不是这个原因</button>
    </div>
  `;

  for (const button of elements["inference-panel"].querySelectorAll("button")) {
    button.addEventListener("click", () => {
      state.events = applyInferenceDecision(
        state.events,
        inference.event_id,
        button.dataset.inferenceDecision,
      );
      persistState();
      renderTimeline(state.events);
      renderInference();
      announce(button.dataset.inferenceDecision === "confirmed" ? "推测已确认" : "推测已否定");
    });
  }
}

function renderPlan(scenario) {
  elements["plan-version"].textContent = `第 ${state.plan.version} 版`;
  elements["plan-direction"].textContent = state.plan.direction;
  elements["plan-constraint"].textContent = state.plan.constraint;
  elements["stage-path"].innerHTML = state.plan.stages
    .map(
      (stage) => `
        <div class="stage" data-state="${escapeHtml(stage.state)}">
          <strong>${escapeHtml(stage.label)}</strong>
          <small>${escapeHtml(stage.note)}</small>
        </div>
      `,
    )
    .join("");
  elements["current-actions"].innerHTML = state.plan.currentActions
    .map((action) => `<li>${escapeHtml(action)}</li>`)
    .join("");
  renderAdjustment(scenario);
}

function renderAdjustment(scenario) {
  const panel = elements["adjustment-panel"];
  const adjustment = scenario.adjustment;

  if (state.adjustmentDecision) {
    const adopted = state.adjustmentDecision === "adopted";
    panel.innerHTML = `
      <p class="kicker">调整记录</p>
      <h3 id="adjustment-title">${adopted ? "已经采用新的行动安排" : "已经保留原方案"}</h3>
      <p class="adjustment-result">${adopted ? `当前方案为第 ${state.plan.version} 版，旧行动仍在修订记录中。` : "这次建议已收起；生活条件再次变化时仍可重看。"}</p>
    `;
    return;
  }

  panel.innerHTML = `
    <p class="kicker">条件发生变化</p>
    <h3 id="adjustment-title">${escapeHtml(adjustment.headline)}</h3>
    <p>${escapeHtml(adjustment.reason)}</p>
    <h4>建议替换为</h4>
    <ul>${adjustment.replaceActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>
    <p class="tradeoff"><strong>需要接受的取舍：</strong>${escapeHtml(adjustment.tradeoff)}</p>
    <div class="button-row">
      <button type="button" class="primary-button" data-adjustment-decision="adopted">采用这次调整</button>
      <button type="button" class="secondary-button" data-adjustment-decision="rejected">保留原方案</button>
    </div>
  `;

  for (const button of panel.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      const decision = button.dataset.adjustmentDecision;
      state.plan =
        decision === "adopted"
          ? adoptAdjustment(state.plan, adjustment)
          : rejectAdjustment(state.plan, adjustment);
      state.adjustmentDecision = decision;
      persistState();
      renderPlan(scenario);
      announce(decision === "adopted" ? `已采用调整，当前为第 ${state.plan.version} 版` : "已保留原方案");
    });
  }
}

function render() {
  const scenario = getScenario(currentScenarioId);
  const errors = validateEvents(state.events);
  renderSwitcher();
  renderHero(scenario);
  renderValidation(errors);
  renderTimeline(state.events.filter((event) => validateEvent(event).valid));
  renderInference();
  renderPlan(scenario);
}

elements["capture-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  handleCapture(elements["capture-input"].value);
});

for (const button of document.querySelectorAll("[data-sample]")) {
  button.addEventListener("click", () => {
    elements["capture-input"].value = button.dataset.sample;
    handleCapture(button.dataset.sample);
  });
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
elements["capture-voice"].addEventListener("click", () => {
  if (!SpeechRecognition) {
    showCaptureReply("当前浏览器没有提供语音识别。这个演示可以先输入一句话；安卓版本会接入系统语音入口。");
    elements["capture-input"].focus();
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onstart = () => {
    elements["capture-voice"].dataset.listening = "true";
    elements["capture-voice"].lastChild.textContent = " 正在听…";
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    elements["capture-input"].value = transcript;
    handleCapture(transcript);
  };
  recognition.onerror = () => {
    showCaptureReply("这次没有听清。你可以再按一次，也可以直接输入一句话。");
  };
  recognition.onend = () => {
    elements["capture-voice"].dataset.listening = "false";
    elements["capture-voice"].lastChild.textContent = " 按一下说话";
  };
  recognition.start();
});

elements["reset-demo"].addEventListener("click", () => {
  try {
    localStorage.removeItem(storageKey(currentScenarioId));
  } catch {
    // The in-memory reset below still works when storage is unavailable.
  }
  state = initialState(currentScenarioId);
  render();
  announce("这段演示已重置");
});

render();
