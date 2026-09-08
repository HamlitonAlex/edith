import { createCompanionState, receiveMessage } from "/lib/companion-state.js";

const $ = (selector) => document.querySelector(selector);
const storageKey = "xuecheng:companion:v3";
let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return createCompanionState();
    const defaults = createCompanionState();
    const legacyThemes = { sky: "sand", mint: "sage", dusk: "plum" };
    saved.theme = legacyThemes[saved.theme] || (["peach", "sand", "sage", "plum"].includes(saved.theme) ? saved.theme : defaults.theme);
    saved.schedule = (saved.schedule || defaults.schedule).map((item, index) => {
      if (item.platform) return item;
      const fallback = defaults.schedule[index] || defaults.schedule[0];
      return { ...item, platform: fallback.platform, action: fallback.action,
        contentTitle: item.contentTitle || fallback.contentTitle,
        contentUrl: item.contentUrl || fallback.contentUrl,
        completion: item.completion || fallback.completion,
        status: item.contentUrl ? item.status : fallback.status };
    });
    return saved;
  } catch {
    return createCompanionState();
  }
}
function save() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const taskStatus = { completed: "已完成", working: "进行中", waiting: "等待" };

function renderLifeStream() {
  const assistantName = state.assistantName || "小程";
  const items = [

    ...(state.schedule || []).map((item) => ({
      source: "今日安排",
      moment: item.time,
      eyebrow: `${item.area} · ${item.platform || "平台待选择"}`,
      title: item.contentTitle || "内容待选择",
      detail: item.contentTitle
        ? `${item.action || "完成"} · ${item.completion || "完成后告诉我你的收获"}`
        : "时间已经明确，但还必须选定具体视频、文章或任务，这条安排才完整。",
      status: item.contentUrl ? `打开${item.platform || "内容"}` : "选择内容",
      tone: item.contentUrl ? "understood" : "waiting",
      href: item.contentUrl,
      compose: item.contentUrl ? null : `帮我为${item.time}的${item.area}时段选择一个具体内容，并说明为什么适合我`,
    })),
    ...state.tasks
      .filter((task) => task.status === "working")
      .slice(0, 1)
      .map((task) => ({
        source: assistantName,
        moment: "正在处理",
        title: task.title,
        detail: task.detail,
        status: "进行中",
        tone: "working",
      })),
    ...state.memories.slice(-2).reverse().map((memory) => ({
      source: "与你的对话",
      moment: `${Math.round(memory.confidence * 100)}% 把握`,
      title: memory.text,
      detail: `来源：${memory.source}。你可以在“助手与权限”中纠正或删除。`,
      status: "已理解",
      tone: "understood",
    })),
  ];

  $("#life-stream").innerHTML = items
    .map((item) => {
      const action = item.href
        ? `<a class="event-action ${item.tone}" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.status)}</a>`
        : item.compose
          ? `<button class="event-action ${item.tone}" type="button" data-compose="${escapeHtml(item.compose)}">${escapeHtml(item.status)}</button>`
          : `<span class="event-state ${item.tone}">${escapeHtml(item.status)}</span>`;
      const eyebrow = item.eyebrow ? `<span class="event-eyebrow">${escapeHtml(item.eyebrow)}</span>` : "";
      return `<article class="life-event"><div class="event-source"><b>${escapeHtml(item.source)}</b><span>${escapeHtml(item.moment)}</span></div><div class="event-copy">${eyebrow}<p>${escapeHtml(item.title)}</p><small>${escapeHtml(item.detail)}</small></div>${action}</article>`;
    })
    .join("");

  document.querySelectorAll("[data-compose]").forEach((button) => {
    button.onclick = () => {
      $("#chat-input").value = button.dataset.compose;
      $("#chat-input").focus();
    };
  });
}

function render() {
  const assistantName = state.assistantName || "小程";
  document.documentElement.dataset.theme = state.theme || "peach";
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === state.theme));
  });
  document.querySelectorAll("[data-assistant-name]").forEach((node) => { node.textContent = assistantName; });
  $("#assistant-name").value = assistantName;
  renderLifeStream();

  $("#map-direction").textContent = state.activeDirection || "尚未形成";
  $("#area-grid").innerHTML = state.areas.map(
    (area) => `<article class="area ${area.status}"><span>${area.status === "active" ? "当前方向" : area.status === "observing" ? "观察中" : "背景维度"}</span><h2>${escapeHtml(area.title)}</h2><p>${escapeHtml(area.description)}</p><small>${escapeHtml(area.note)}</small></article>`,
  ).join("");

  $("#memory-list").innerHTML = state.memories.length ? state.memories.map(
    (memory) => `<article><span>${Math.round(memory.confidence * 100)}% 把握</span><h2>${escapeHtml(memory.text)}</h2><p>来源：${escapeHtml(memory.source)}</p><button data-forget="${escapeHtml(memory.key)}">删除这条理解</button></article>`,
  ).join("") : `<div class="empty">继续聊几句后，可纠正的长期理解会出现在这里。</div>`;

  $("#task-list").innerHTML = state.tasks.length ? state.tasks.map(
    (task) => `<article><span>${taskStatus[task.status] || "等待"}</span><h2>${escapeHtml(task.title)}</h2><p>${escapeHtml(task.detail)}</p></article>`,
  ).join("") : `<div class="empty">助手还没有开始后台任务。</div>`;

  $("#initiative").value = state.initiative;
  $("#initiative-label").textContent = `${Math.round(state.initiative * 100)}%`;
  const changedAreas = state.areas.filter((area) => area.status !== "background").length;
  $("#map-change").textContent = changedAreas;
  $("#map-change").hidden = changedAreas === 0;

  document.querySelectorAll("[data-forget]").forEach((button) => {
    button.onclick = () => {
      state.memories = state.memories.filter((memory) => memory.key !== button.dataset.forget);
      save();
      render();
    };
  });
}

function sendMessage(text) {
  if (!String(text).trim()) return;
  state = receiveMessage(state, text);
  save();
  render();
}

const tabs = [...document.querySelectorAll(".tab")];
function activateTab(button) {
  tabs.forEach((tab) => {
    const selected = tab === button;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    const panel = $("#" + tab.getAttribute("aria-controls"));
    panel.classList.toggle("active", selected);
    panel.hidden = !selected;
  });
}
tabs.forEach((button, index) => {
  button.onclick = () => activateTab(button);
  button.onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    activateTab(next);
    next.focus();
  };
});

$("#chat-form").onsubmit = (event) => {
  event.preventDefault();
  const input = $("#chat-input");
  sendMessage(input.value);
  input.value = "";
};

const detailsDialog = $("#assistant-details");
$("#assistant-details-button").onclick = () => detailsDialog.showModal();
$("#assistant-details-close").onclick = () => detailsDialog.close();
document.querySelectorAll("[data-open-connections]").forEach((button) => {
  button.onclick = () => {
    detailsDialog.showModal();
    $("#connection-settings").scrollIntoView({ block: "start" });
  };
});

$("#assistant-name").onchange = (event) => {
  state.assistantName = event.target.value.trim() || "小程";
  save();
  render();
};
$("#settings-button").onclick = (event) => {
  const section = $("#settings-section");
  section.hidden = !section.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!section.hidden));
};
document.querySelectorAll("[data-theme-option]").forEach((button) => {
  button.onclick = () => {
    state.theme = button.dataset.themeOption;
    save();
    render();
  };
});

$("#initiative").oninput = (event) => {
  state.initiative = Number(event.target.value);
  save();
  render();
};

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const voiceButton = $("#voice-button");
let activeRecognition = null;
function setVoiceLabel(text) { voiceButton.querySelector("b").textContent = text; }
voiceButton.onpointerdown = (event) => {
  if (!Recognition) {
    setVoiceLabel("浏览器不支持");
    return;
  }
  event.preventDefault();
  voiceButton.setPointerCapture?.(event.pointerId);
  activeRecognition = new Recognition();
  activeRecognition.lang = "zh-CN";
  activeRecognition.interimResults = false;
  activeRecognition.onstart = () => setVoiceLabel("正在听");
  activeRecognition.onresult = (resultEvent) => { $("#chat-input").value = resultEvent.results[0][0].transcript; };
  activeRecognition.onerror = () => setVoiceLabel("语音失败，重试");
  activeRecognition.onend = () => {
    activeRecognition = null;
    if (voiceButton.querySelector("b").textContent === "正在听") setVoiceLabel("按住说话");
  };
  activeRecognition.start();
};
function stopRecognition() {
  if (activeRecognition) activeRecognition.stop();
}
voiceButton.onpointerup = stopRecognition;
voiceButton.onpointercancel = stopRecognition;
voiceButton.onlostpointercapture = stopRecognition;

$("#current-date").textContent = new Intl.DateTimeFormat("zh-CN", {
  month: "long", day: "numeric", weekday: "long",
}).format(new Date());

render();
