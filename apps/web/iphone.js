import { createAgentState, hydrateAgentState, runAgentTurn } from "./agent/index.js";
import { createEncryptedBackup, readEncryptedBackup } from "./local-backup.js";
import { MODEL_PROVIDERS, fetchProviderModels, getProvider, requestProviderReply } from "./agent/model-providers.js";
import { conversationDayLabel, formatConversationTime, mergeStoredConversation } from "./lib/conversation-history.js";

const storageKey = "xuecheng:iphone:v2";
const agentStorageKey = "xuecheng:agent:v1";
const defaultAvatar = "./assets/xuecheng-mark.svg";
const legacyDefaultAvatar = "./assets/companion-default.png";
const defaults = { name: "小程", theme: "day", role: "guide", gender: "female", initiative: .65, directness: .55, avatar: defaultAvatar, messages: [], currentConversationModel: "local", modelConfig: null, cloudConsent: false, onboardingComplete: false, sources: [], calendarEvents: [], quietStart: "23:00", quietEnd: "07:30", urgentOverride: true };
const legacyThemes = { apricot: "day", sage: "day", plum: "day", citrus: "day", meadow: "day", berry: "day", dusk: "day", elegant: "day", silver: "night" };
const themeColors = { day: "#f5f6f3", night: "#202522" };
const pronounFor = gender => gender === "male" ? "他" : gender === "neutral" ? "TA" : "她";
const roleCopy = (role, pronoun) => ({
  guide: `${pronoun}会像一位了解你的引路人，给建议，也会指出你正在回避的问题。`,
  friend: `${pronoun}会像一个长期了解你的朋友，先理解你，再陪你把事情想清楚。`,
  family: `${pronoun}会像家人一样关心你的生活基础，同时尊重你的选择。`,
  partner: `${pronoun}会以亲密伙伴的方式陪伴、讨论和共同规划，但不会替你决定人生。`
}[role]);

const $ = selector => document.querySelector(selector);
let toastTimer;
let state = load();
let agentState = loadAgent();
let pendingAttachments = [];
let onboardingIndex = 0;
const screenOrder = ["chat", "today", "path", "us", "settings"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let screenAnimations = [];

function load() {
  try {
    const current = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const legacy = JSON.parse(localStorage.getItem("xuecheng:iphone:v1") || "{}");
    const saved = Object.keys(current).length ? current : legacy;
    saved.messages = mergeStoredConversation(legacy.messages, current.messages);
    const savedAvatar = saved.avatar && saved.avatar !== legacyDefaultAvatar ? saved.avatar : defaultAvatar;
    return { ...defaults, ...saved, theme: legacyThemes[saved.theme] || saved.theme || defaults.theme, avatar: savedAvatar };
  } catch {
    return { ...defaults };
  }
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadAgent() {
  try { return hydrateAgentState(JSON.parse(localStorage.getItem(agentStorageKey) || "null")); }
  catch { return createAgentState(); }
}

function saveAgent() {
  localStorage.setItem(agentStorageKey, JSON.stringify(agentState));
}

function addMessage(message) {
  state.messages.push({ ...message, createdAt: new Date().toISOString() });
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function safeImageUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function renderOnboarding() {
  if (state.onboardingComplete) return;
  const steps = [...document.querySelectorAll("[data-onboarding-step]")];
  steps.forEach((step, index) => { step.hidden = index !== onboardingIndex; });
  document.querySelectorAll(".onboarding-progress i").forEach((dot, index) => dot.classList.toggle("active", index === onboardingIndex));
  document.querySelectorAll("[data-onboarding-role]").forEach(button => button.classList.toggle("active", button.dataset.onboardingRole === state.role));
  $("#onboarding-name").value = state.name;
  $("#onboarding-initiative").value = state.initiative;
  $("#onboarding-directness").value = state.directness;
  $("#onboarding-initiative-value").textContent = `${Math.round(state.initiative * 100)}%`;
  $("#onboarding-directness-value").textContent = `${Math.round(state.directness * 100)}%`;
}

function renderAttachments() {
  const preview = $("#attachment-preview");
  preview.hidden = pendingAttachments.length === 0;
  preview.innerHTML = pendingAttachments.map((item, index) => `<div class="attachment-chip">${item.type.startsWith("image/") ? `<img src="${item.dataUrl}" alt="">` : ""}<span>${escapeHtml(item.name)}</span><button type="button" data-remove-attachment="${index}" aria-label="移除附件">×</button></div>`).join("");
  $(".send-button").classList.toggle("ready", Boolean($("#chat-input").value.trim() || pendingAttachments.length));
}

function renderModelControls() {
  const providerSelect = $("#provider-select");
  const config = state.modelConfig || { providerId: "openai", endpoint: getProvider("openai").baseUrl, model: "" };
  if (!providerSelect.dataset.initialized) {
    providerSelect.innerHTML = MODEL_PROVIDERS.map(provider => `<option value="${provider.id}">${escapeHtml(provider.name)}</option>`).join("");
    providerSelect.value = config.providerId;
    $("#api-endpoint").value = config.endpoint || getProvider(config.providerId).baseUrl;
    $("#api-key").value = sessionStorage.getItem(`xuecheng:key:${config.providerId}`) || "";
    providerSelect.dataset.initialized = "true";
  }
  const modelSelect = $("#model-select");
  if (config.model && ![...modelSelect.options].some(option => option.value === config.model)) modelSelect.add(new Option(config.model, config.model));
  if (config.model) modelSelect.value = config.model;
  const options = [{ value: "local", label: "本地判断" }, ...(state.modelConfig?.model && state.cloudConsent ? [{ value: state.modelConfig.model, label: state.modelConfig.model }] : [])];
  $("#conversation-model-options").innerHTML = options.map(option => `<button type="button" data-conversation-model="${escapeHtml(option.value)}" class="${state.currentConversationModel === option.value ? "active" : ""}">${escapeHtml(option.label)}</button>`).join("");
}

function showToast(message) {
  const toast = $("#app-toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function renderToday(pronoun) {
  const action = agentState.next_recommended_action;
  $("#energy-check").hidden = !agentState.long_term_goals.length;
  $("#today-empty").hidden = Boolean(action);
  $("#today-agenda").innerHTML = action ? `<li class="next"><time>下一步<small>${action.duration_minutes} 分钟</small></time><div><small>${escapeHtml(action.platform)} · ${escapeHtml(agentState.skills[action.skill_id]?.label || "当前方向")}</small><h2>${escapeHtml(action.title)}</h2><p class="growth-trace"><b>为什么现在：</b>${escapeHtml(action.why_now)}</p><details class="agenda-details"><summary>查看怎么做和完成标准</summary><p><b>怎么做：</b>${escapeHtml(action.instructions)}</p><p><b>完成标准：</b>${escapeHtml(action.completion_criteria)}</p></details><div class="agenda-actions"><button type="button" data-start-current>${action.resource?.url ? `打开${escapeHtml(action.platform)}并开始` : "开始讲解"}</button><button type="button" data-discuss="这个安排哪里不适合我？">和${pronoun}讨论</button></div></div><span>现在最值得推进</span></li>` : "";
}

function renderPath() {
  const goal = agentState.long_term_goals[0];
  $("#path-empty").hidden = Boolean(goal);
  $("#current-direction").hidden = !goal;
  $("#direction-title").textContent = goal?.text || "";
  const skills = Object.values(agentState.skills).filter(skill => skill.evidence.length);
  $("#path-list").innerHTML = skills.map((skill, index) => `<article><i>${String(index + 1).padStart(2, "0")}</i><div><b>${escapeHtml(skill.label)}</b><p>${escapeHtml(skill.evidence.at(-1))}</p></div></article>`).join("");
}

function render() {
  const pronoun = pronounFor(state.gender);
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[state.theme] || themeColors.day);
  document.querySelectorAll("[data-name]").forEach(node => { node.textContent = state.name; });
  document.querySelectorAll("[data-avatar]").forEach(node => { node.src = state.avatar; });
  $("#companion-name").value = state.name;
  $("#initiative").value = state.initiative;
  $("#initiative-value").textContent = `${Math.round(state.initiative * 100)}%`;
  $("#relationship-copy").textContent = roleCopy(state.role, pronoun);
  document.querySelectorAll("[data-role]").forEach(button => button.classList.toggle("active", button.dataset.role === state.role));
  document.querySelectorAll("[data-gender]").forEach(button => button.classList.toggle("active", button.dataset.gender === state.gender));
  document.querySelectorAll("[data-pronoun]").forEach(node => { node.textContent = pronoun; });
  $("#chat-input").placeholder = `和${pronoun}说说现在的想法……`;
  document.querySelectorAll("[data-theme-option]").forEach(button => {
    const active = button.dataset.themeOption === state.theme;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("active", active);
  });
  $("#quiet-start").value = state.quietStart;
  $("#quiet-end").value = state.quietEnd;
  $("#urgent-override").checked = state.urgentOverride;
  const selectedModel = state.currentConversationModel === "local" ? "本地判断" : state.currentConversationModel;
  $("#model-summary").textContent = selectedModel;
  $("#conversation-model").textContent = selectedModel;
  let previousDay = "";
  $("#dynamic-messages").innerHTML = state.messages.map(message => {
    const day = conversationDayLabel(message.createdAt);
    const divider = day !== previousDay ? `<div class="conversation-day-divider"><span>${escapeHtml(day)}</span></div>` : "";
    previousDay = day;
    const time = formatConversationTime(message.createdAt);
    const content = message.role === "user"
      ? `<article class="message user-message"><div><p>${escapeHtml(message.text)}</p>${message.attachments?.length ? `<small class="message-attachments">${message.attachments.map(item => escapeHtml(item.name)).join(" · ")}</small>` : ""}<time>${time}</time></div></article>`
      : `<article class="message companion-message"><div><p>${escapeHtml(message.text)}</p>${message.rationale ? `<details class="decision-trace"><summary>她为什么这样判断</summary><p>${escapeHtml(message.rationale)}</p></details>` : ""}<time>${time}</time></div></article>`;
    return divider + content;
  }).join("");
  $("#empty-conversation").hidden = state.messages.length > 0 || Boolean(agentState.next_recommended_action);
  renderToday(pronoun);
  renderPath();
  $("#reset-avatar").hidden = state.avatar === defaultAvatar;
  const action = agentState.next_recommended_action;
  $("#agent-proposal").hidden = !action;
  $("#agent-proposal").classList.toggle("external", Boolean(action?.resource?.url));
  $("#agent-proposal").classList.toggle("started", action?.status === "accepted");
  const proposalMedia = $("#proposal-media");
  const proposalImage = $("#proposal-media-image");
  proposalMedia.hidden = true;
  proposalImage.removeAttribute("src");
  if (action) {
    $("#proposal-time").textContent = `${action.duration_minutes} 分钟`;
    $("#proposal-platform").textContent = `${action.platform} · ${agentState.skills[action.skill_id]?.label || "当前方向"}`;
    $("#proposal-title").textContent = action.title;
    $("#proposal-why").textContent = action.why_now;
    $("#proposal-instructions").textContent = action.instructions;
    $("#proposal-completion").textContent = action.completion_criteria;
    const imageUrl = safeImageUrl(action.resource?.image_url);
    if (imageUrl) {
      proposalImage.src = imageUrl;
      proposalImage.alt = action.resource?.image_alt || `${action.title}的资源封面`;
      proposalMedia.hidden = false;
      proposalImage.onerror = () => { proposalMedia.hidden = true; };
    }
    const start = $("#start-action");
    start.textContent = action.resource?.url ? `打开${action.platform}并开始` : "开始讲解";
    start.disabled = action.status === "accepted";
    $("#discuss-action").textContent = `和${pronoun}讨论`;
  }
  $("#onboarding").hidden = state.onboardingComplete;
  $("#settings-cloud-consent").checked = state.cloudConsent;
  $("#cloud-consent").checked = state.cloudConsent;
  $("#source-summary").textContent = state.sources.length ? `${state.sources.length} 项资料可被引用，可随时清除` : "目前没有长期引用的资料";
  $("#calendar-summary").textContent = state.calendarEvents.length ? `已在本地读取 ${state.calendarEvents.length} 项日历安排` : "可导入标准 .ics 日历，在本地识别现实时间";
  renderModelControls();
  renderAttachments();
  renderOnboarding();
}

function openScreen(name) {
  const currentScreen = document.querySelector(".screen.active");
  const currentName = currentScreen?.dataset.screen;
  if (currentName === name) return;
  const nextScreen = document.querySelector(`.screen[data-screen="${name}"]`);
  const phone = $(".phone");
  const direction = screenOrder.indexOf(name) < screenOrder.indexOf(currentName) ? -1 : 1;
  phone.dataset.direction = direction < 0 ? "backward" : "forward";
  screenAnimations.forEach(animation => animation.cancel());
  screenAnimations = [];
  document.querySelectorAll(".screen").forEach(screen => {
    if (screen !== currentScreen && screen !== nextScreen) {
      screen.hidden = true;
      screen.classList.remove("active");
      screen.style.removeProperty("z-index");
    }
  });
  nextScreen.hidden = false;
  nextScreen.classList.add("active");
  nextScreen.scrollTop = 0;
  currentScreen?.classList.remove("active");
  if (currentScreen && !reduceMotion.matches && typeof nextScreen.animate === "function") {
    nextScreen.style.zIndex = "3";
    currentScreen.style.zIndex = "2";
    const incoming = nextScreen.animate([
      { opacity: 0, transform: `translate3d(${direction * 22}px,0,0) scale(.995)` },
      { opacity: 1, transform: "translate3d(0,0,0) scale(1)" }
    ], { duration: 300, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    const outgoing = currentScreen.animate([
      { opacity: 1, transform: "translate3d(0,0,0)" },
      { opacity: 0, transform: `translate3d(${direction * -8}px,0,0)` }
    ], { duration: 190, easing: "cubic-bezier(.4,0,1,1)", fill: "both" });
    screenAnimations = [incoming, outgoing];
    Promise.allSettled(screenAnimations.map(animation => animation.finished)).then(() => {
      if (!nextScreen.classList.contains("active")) return;
      currentScreen.hidden = true;
      currentScreen.classList.remove("active");
      [currentScreen, nextScreen].forEach(screen => screen.style.removeProperty("z-index"));
      screenAnimations = [];
    });
  } else {
    if (currentScreen) {
      currentScreen.hidden = true;
      currentScreen.classList.remove("active");
    }
  }
  document.querySelectorAll("[data-nav]").forEach(button => {
    const navName = name === "settings" ? "us" : name;
    const active = button.dataset.nav === navName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

function openTaskConversation(prompt) {
  openScreen("chat");
  const input = $("#chat-input");
  input.value = prompt;
  input.focus();
  showToast("内容已放进对话框，确认后发送");
}

document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => openScreen(button.dataset.nav)));
document.querySelectorAll("[data-open-screen]").forEach(button => button.addEventListener("click", () => openScreen(button.dataset.openScreen)));
document.querySelectorAll("[data-task-chat]").forEach(button => button.addEventListener("click", () => openTaskConversation(button.dataset.taskChat)));

document.querySelectorAll("[data-onboarding-next]").forEach(button => button.addEventListener("click", () => {
  state.name = $("#onboarding-name").value.trim() || "小程";
  onboardingIndex = Math.min(2, onboardingIndex + 1);
  save();
  render();
}));
document.querySelectorAll("[data-onboarding-skip]").forEach(button => button.addEventListener("click", () => {
  if (onboardingIndex < 2) onboardingIndex += 1;
  else state.onboardingComplete = true;
  save();
  render();
}));
document.querySelectorAll("[data-onboarding-role]").forEach(button => button.addEventListener("click", () => {
  state.role = button.dataset.onboardingRole;
  renderOnboarding();
}));
[["#onboarding-initiative", "initiative", "#onboarding-initiative-value"], ["#onboarding-directness", "directness", "#onboarding-directness-value"]].forEach(([selector, key, output]) => {
  $(selector).addEventListener("input", event => {
    state[key] = Number(event.target.value);
    $(output).textContent = `${Math.round(state[key] * 100)}%`;
  });
});
$("#cloud-consent").addEventListener("change", event => { state.cloudConsent = event.target.checked; });
$("[data-onboarding-finish]").addEventListener("click", () => {
  state.name = $("#onboarding-name").value.trim() || "小程";
  state.cloudConsent = $("#cloud-consent").checked;
  state.onboardingComplete = true;
  save();
  render();
  showToast("准备好了。先随便和我说一句吧");
});

const guideSystemPrompt = () => `你是学程中的${state.name}，一位会长期了解用户的私人教育引路人。你的任务不是生成课表，而是观察、判断、协商、陪伴执行和验收。自然交流；信息不足就只问最关键的一件事。每次最多提出一件下一步行动，必须具体说明做什么、多久、怎么做、完成标准、为什么现在值得。可以提出不同意见，但用户拥有最终决定权。不要声称看到了未提供的信息，不要暴露隐藏思维链。`;

function modelMessages(latestText, attachments) {
  const history = state.messages.slice(-12).map(message => ({ role: message.role, content: message.text }));
  const attachmentText = attachments.filter(item => item.text).map(item => `\n[附件：${item.name}]\n${item.text}`).join("");
  const imageParts = attachments.filter(item => item.type.startsWith("image/")).map(item => ({ type: "image_url", image_url: { url: item.dataUrl } }));
  const content = imageParts.length ? [{ type: "text", text: `${latestText || "请理解我发送的内容"}${attachmentText}` }, ...imageParts] : `${latestText}${attachmentText}`;
  if (history.at(-1)?.role === "user") history.pop();
  return [...history, { role: "user", content }];
}

$("#chat-form").addEventListener("submit", async event => {
  event.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text && !pendingAttachments.length) {
    showToast("先说一句你现在最想解决的事");
    input.focus();
    return;
  }
  const submittedAttachments = pendingAttachments;
  pendingAttachments = [];
  $("#agent-proposal").classList.remove("discussing");
  const userText = text || "请看看我发来的内容。";
  addMessage({ role: "user", text: userText, attachments: submittedAttachments.map(({ name, type }) => ({ name, type })) });
  const agentResult = runAgentTurn(agentState, `${userText}${submittedAttachments.filter(item => item.text).map(item => `\n${item.text}`).join("")}`);
  agentState = agentResult.state;
  input.value = "";
  resizeComposer();
  save();
  saveAgent();
  render();
  const useCloud = state.cloudConsent && state.modelConfig?.model && state.currentConversationModel !== "local";
  let reply = agentResult.reply;
  if (useCloud) {
    const working = document.createElement("article");
    working.className = "message companion-message work-state";
    working.innerHTML = "<div><p>正在结合你刚才说的内容……</p></div>";
    $("#dynamic-messages").append(working);
    const conversation = $("#conversation");
    conversation.scrollTo({ top: conversation.scrollHeight, behavior: "auto" });
    try {
      reply = await requestProviderReply({
        ...state.modelConfig,
        apiKey: sessionStorage.getItem(`xuecheng:key:${state.modelConfig.providerId}`) || "",
        system: guideSystemPrompt(),
        messages: modelMessages(userText, submittedAttachments),
      });
    } catch (error) {
      showToast(`云端连接没有成功，已用本地判断继续：${error.message}`);
    } finally { working.remove(); }
  }
  addMessage({ role: "assistant", text: reply, kind: agentResult.kind, rationale: agentResult.kind === "proposal" ? "依据你刚才明确表达的目标、现有时间与最近对话；如果这些条件变化，我会重新判断。" : "" });
  if (submittedAttachments.length) {
    state.pendingSourceNames = submittedAttachments.map(item => item.name);
    addMessage({ role: "assistant", text: "这些内容我先只用于这次对话。你希望其中哪些成为以后也能参考的资料？你也可以直接说“只用这一次”。", kind: "source-boundary" });
  } else if (state.pendingSourceNames?.length && /长期|以后.*参考|记住|保留/.test(userText)) {
    state.sources = [...new Set([...state.sources, ...state.pendingSourceNames])];
    state.pendingSourceNames = [];
  } else if (state.pendingSourceNames?.length && /只.*一次|不用记|别记|不保留/.test(userText)) {
    state.pendingSourceNames = [];
  }
  save();
  render();
  const recent = [...document.querySelectorAll("#dynamic-messages .message")].slice(-2);
  recent.forEach((message, index) => {
    message.style.setProperty("--enter-delay", `${index * 70}ms`);
    if (!reduceMotion.matches) message.classList.add("message-enter");
  });
  requestAnimationFrame(() => {
    const conversation = $("#conversation");
    conversation.scrollTo({ top: conversation.scrollHeight, behavior: reduceMotion.matches ? "auto" : "smooth" });
  });
});

let pendingExternalUrl = "";
let leftForExternalAction = false;

function acceptCurrentAction() {
  if (!agentState.next_recommended_action) return null;
  const result = runAgentTurn(agentState, "接受这个安排，现在开始");
  agentState = result.state;
  addMessage({ role: "assistant", text: result.reply, kind: result.kind });
  save();
  saveAgent();
  render();
  return result;
}

function openExternalConfirmation(url) {
  pendingExternalUrl = url;
  $("#external-action-dialog").showModal();
}

function discussCurrentAction(prompt = "这个安排有些地方不适合我，我们讨论一下。") {
  const action = agentState.next_recommended_action;
  openScreen("chat");
  $("#agent-proposal").classList.add("discussing");
  addMessage({ role: "assistant", text: action ? `可以。先不急着执行。${action.title}这件事里，是时间、内容、方式，还是我对“为什么现在”的判断让你觉得不合适？` : "可以，我们一起调整。你最想先改变哪一部分？" });
  save();
  render();
  const input = $("#chat-input");
  input.value = prompt;
  input.focus();
}

$("#start-action").addEventListener("click", () => {
  const action = agentState.next_recommended_action;
  if (!action) return;
  if (action.resource?.url) return openExternalConfirmation(action.resource.url);
  acceptCurrentAction();
  showToast("已经开始，我会一次只陪你推进一小块");
});
$("#discuss-action").addEventListener("click", () => discussCurrentAction());
document.addEventListener("click", event => {
  const external = event.target.closest("[data-external-url]");
  if (external) openExternalConfirmation(external.dataset.externalUrl);
  const discuss = event.target.closest("[data-discuss]");
  if (discuss) discussCurrentAction(discuss.dataset.discuss);
  if (event.target.closest("[data-start-current]")) $("#start-action").click();
});
$("#confirm-external-action").addEventListener("click", () => {
  const url = pendingExternalUrl;
  if (!url) return;
  acceptCurrentAction();
  leftForExternalAction = true;
  window.open(url, "_blank", "noopener,noreferrer");
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !leftForExternalAction) return;
  leftForExternalAction = false;
  addMessage({ role: "assistant", text: "你回来了。刚才看到哪里？不用总结，随口说一句最让你停顿或意外的地方就行。", kind: "follow-up" });
  save();
  render();
  openScreen("chat");
});

$("#companion-name").addEventListener("change", event => {
  state.name = event.target.value.trim() || "小程";
  save();
  render();
  showToast(`以后就叫${pronounFor(state.gender)}“${state.name}”`);
});

document.querySelectorAll("[data-role]").forEach(button => button.addEventListener("click", () => {
  state.role = button.dataset.role;
  save();
  render();
  showToast("相处方式已更新");
}));

document.querySelectorAll("[data-theme-option]").forEach(button => button.addEventListener("click", () => {
  state.theme = button.dataset.themeOption;
  save();
  render();
  showToast(`已经换成“${button.textContent.trim()}”`);
}));

document.querySelectorAll("[data-gender]").forEach(button => button.addEventListener("click", () => {
  state.gender = button.dataset.gender;
  save();
  render();
  showToast("伙伴的称呼已经更新");
}));

[["#urgent-override", "urgentOverride"]].forEach(([selector, key]) => {
  $(selector).addEventListener("change", event => {
    state[key] = event.target.checked;
    save();
    render();
    showToast("设置已保存");
  });
});

[["#quiet-start", "quietStart"], ["#quiet-end", "quietEnd"]].forEach(([selector, key]) => {
  $(selector).addEventListener("change", event => {
    state[key] = event.target.value;
    save();
    render();
    showToast(`安静时段：${state.quietStart} - ${state.quietEnd}`);
  });
});

$("#conversation-model").addEventListener("click", () => {
  renderModelControls();
  $("#model-dialog").showModal();
});
$("#conversation-model-options").addEventListener("click", event => {
  const button = event.target.closest("[data-conversation-model]");
  if (!button) return;
  state.currentConversationModel = button.dataset.conversationModel;
  save();
  render();
  $("#model-dialog").close();
  showToast("只切换了当前对话的模型");
});

$("#settings-cloud-consent").addEventListener("change", event => {
  state.cloudConsent = event.target.checked;
  if (!state.cloudConsent) state.currentConversationModel = "local";
  save();
  render();
});
$("#provider-select").addEventListener("change", event => {
  const provider = getProvider(event.target.value);
  $("#api-endpoint").value = provider.baseUrl;
  $("#api-key").value = sessionStorage.getItem(`xuecheng:key:${provider.id}`) || "";
  $("#model-select").innerHTML = '<option value="">先获取模型</option>';
});

function currentModelDraft() {
  return { providerId: $("#provider-select").value, endpoint: $("#api-endpoint").value.trim(), apiKey: $("#api-key").value.trim(), model: $("#model-select").value };
}

async function loadModels(showSuccess = true) {
  const draft = currentModelDraft();
  if (!draft.apiKey && draft.providerId !== "ollama") throw new Error("请先填写 API Key");
  const models = await fetchProviderModels(draft);
  if (!models.length) throw new Error("连接成功，但没有找到可对话的模型");
  $("#model-select").innerHTML = models.map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("");
  if (showSuccess) showToast(`连接成功，找到 ${models.length} 个模型`);
  return models;
}

$("#test-model-connection").addEventListener("click", async () => {
  try { await loadModels(true); } catch (error) { showToast(error.message); }
});
$("#fetch-models").addEventListener("click", async () => {
  try { await loadModels(true); } catch (error) { showToast(error.message); }
});
$("#save-model-config").addEventListener("click", () => {
  const draft = currentModelDraft();
  if (!state.cloudConsent) return showToast("请先明确允许当前对话使用云端模型");
  if (!draft.model) return showToast("请先获取并选择一个模型");
  sessionStorage.setItem(`xuecheng:key:${draft.providerId}`, draft.apiKey);
  state.modelConfig = { providerId: draft.providerId, endpoint: draft.endpoint, model: draft.model };
  state.currentConversationModel = draft.model;
  save();
  render();
  showToast("模型已保存；Key 只在本次页面会话中保留");
});

$("#export-backup").addEventListener("click", async () => {
  const password = window.prompt("设置一个备份密码（恢复时需要）");
  if (!password) return;
  try {
    const contents = await createEncryptedBackup({ exported_at: new Date().toISOString(), preferences: state, agent: agentState }, password);
    const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `xuecheng-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("加密备份已导出，请保管好密码");
  } catch (error) { showToast(error.message || "备份导出失败"); }
});

$("#import-backup").addEventListener("click", () => $("#backup-file").click());
$("#backup-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const password = window.prompt("输入这份备份的密码");
  if (!password) return;
  try {
    const restored = await readEncryptedBackup(await file.text(), password);
    if (!restored.preferences || !restored.agent) throw new Error("备份内容不完整");
    if (!window.confirm("恢复会覆盖这台设备上当前的学程记忆。确定继续吗？")) return;
    state = { ...defaults, ...restored.preferences };
    agentState = hydrateAgentState(restored.agent);
    save();
    saveAgent();
    render();
    showToast("本地记忆已经恢复");
  } catch (error) { showToast(error.message || "无法恢复这份备份"); }
  event.target.value = "";
});

$("#initiative").addEventListener("input", event => {
  state.initiative = Number(event.target.value);
  save();
  render();
});

const chatInput = $("#chat-input");
let viewportBaseline = Math.max(window.innerHeight, window.visualViewport?.height || 0);
function resizeComposer() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 92)}px`;
}
chatInput.addEventListener("input", () => { resizeComposer(); renderAttachments(); });
chatInput.addEventListener("focus", () => {
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    syncVisualViewport();
  });
});

const avatarInput = $("#avatar-input");
$("#avatar-trigger").addEventListener("click", () => avatarInput.click());
avatarInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("请选择一张图片");
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    showToast("图片请控制在 4 MB 以内");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.avatar = String(reader.result);
    save();
    render();
    showToast("伙伴图片已经换好");
  });
  reader.readAsDataURL(file);
});
$("#reset-avatar").addEventListener("click", () => {
  state.avatar = defaultAvatar;
  avatarInput.value = "";
  save();
  render();
  showToast("已经恢复学程图标");
});

const attachmentInput = $("#attachment-input");
$("#attachment-trigger").addEventListener("click", () => $("#attachment-dialog").showModal());
document.querySelectorAll("[data-attachment-source]").forEach(button => button.addEventListener("click", () => {
  const source = button.dataset.attachmentSource;
  if (source === "paste") return setTimeout(() => $("#paste-dialog").showModal(), 0);
  attachmentInput.accept = source === "photo" || source === "camera" ? "image/*" : "image/*,text/*,application/pdf";
  if (source === "camera") attachmentInput.setAttribute("capture", "environment");
  else attachmentInput.removeAttribute("capture");
  setTimeout(() => attachmentInput.click(), 0);
}));

function readFileAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve({ name: file.name, type: file.type || "application/octet-stream", dataUrl: String(reader.result), text: "" });
    reader.readAsDataURL(file);
  });
}

attachmentInput.addEventListener("change", async event => {
  const files = [...(event.target.files || [])].slice(0, 4);
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) { showToast(`${file.name} 超过 8 MB，暂未加入`); continue; }
    try {
      const item = await readFileAttachment(file);
      if (file.type.startsWith("text/") || /\.(md|txt|json|csv)$/i.test(file.name)) item.text = (await file.text()).slice(0, 100000);
      pendingAttachments.push(item);
    } catch (error) { showToast(error.message); }
  }
  event.target.value = "";
  renderAttachments();
});
$("#attachment-preview").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-attachment]");
  if (!button) return;
  pendingAttachments.splice(Number(button.dataset.removeAttachment), 1);
  renderAttachments();
});
$("#confirm-paste").addEventListener("click", event => {
  const text = $("#pasted-text").value.trim();
  if (!text) { event.preventDefault(); return showToast("先粘贴一点内容"); }
  pendingAttachments.push({ name: "粘贴的文字", type: "text/plain", text, dataUrl: "" });
  $("#pasted-text").value = "";
  renderAttachments();
});

$("#calendar-import").addEventListener("click", () => $("#calendar-file").click());
$("#calendar-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const source = await file.text();
  const events = [...source.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map(match => {
    const block = match[1];
    const summary = block.match(/\nSUMMARY(?:;[^:]*)?:(.*)/)?.[1]?.trim() || "未命名安排";
    const start = block.match(/\nDTSTART(?:;[^:]*)?:(.*)/)?.[1]?.trim() || "";
    return { summary, start };
  });
  state.calendarEvents = events;
  save();
  render();
  showToast(events.length ? `已在本地导入 ${events.length} 项日历安排` : "没有在文件中找到日历安排");
  event.target.value = "";
});
$("#clear-sources").addEventListener("click", () => {
  if (!state.sources.length) return showToast("目前没有长期引用的资料");
  if (!window.confirm("清除后，学程不会再把这些资料作为长期参考。确定吗？")) return;
  state.sources = [];
  save();
  render();
  showToast("长期资料引用已清除");
});

function syncVisualViewport() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const focusedTextEntry = document.activeElement?.matches('input:not([type="range"]), textarea');
  if (!focusedTextEntry) viewportBaseline = Math.max(viewportBaseline, viewportHeight);
  document.documentElement.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);
  const keyboardOpen = Boolean(window.visualViewport && focusedTextEntry && viewportHeight < viewportBaseline - 80);
  document.body.classList.toggle("keyboard-open", keyboardOpen);
  if (keyboardOpen) requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    chatInput.scrollIntoView({ block: "nearest" });
  });
}
window.visualViewport?.addEventListener("resize", syncVisualViewport);
window.visualViewport?.addEventListener("scroll", syncVisualViewport);
window.addEventListener("resize", syncVisualViewport);
document.addEventListener("focusin", syncVisualViewport);
document.addEventListener("focusout", () => {
  requestAnimationFrame(syncVisualViewport);
  window.scrollTo(0, 0);
});

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
function createVoiceController(surface) {
  let confidence = 0;
  let listening = false;
  const start = () => {
    if (listening) return true;
    if (!Recognition) {
      showToast("当前环境暂不支持语音，请先用文字告诉她");
      return false;
    }
    listening = true;
    confidence = 0;
    surface.classList.add("listening");
    chatInput.setAttribute("placeholder", "正在听，松开结束");
    showToast("正在听，松开结束");
    recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.onresult = result => {
      const best = result.results[0][0];
      confidence = Number(best.confidence || 0);
      chatInput.value = best.transcript;
      resizeComposer();
    };
    recognition.onend = () => {
      listening = false;
      surface.classList.remove("listening");
      chatInput.placeholder = `和${pronounFor(state.gender)}说说现在的想法……`;
      if (chatInput.value.trim() && confidence >= .72) surface.requestSubmit();
      else if (chatInput.value.trim()) showToast("我不太确定是否听准了，你看一眼再发送");
    };
    recognition.onerror = () => {
      listening = false;
      surface.classList.remove("listening");
      chatInput.placeholder = `和${pronounFor(state.gender)}说说现在的想法……`;
      showToast("没有听清，可以再长按一次");
    };
    recognition.start();
    navigator.vibrate?.(18);
    return true;
  };
  const stop = () => {
    if (!listening) return;
    recognition?.stop();
  };
  return { start, stop, isListening: () => listening };
}

const voiceController = createVoiceController($("#chat-form"));
function bindHoldToTalk(surface) {
  let holdTimer = null;
  let holding = false;
  const stop = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (!holding) return;
    holding = false;
    voiceController.stop();
  };
  surface.addEventListener("pointerdown", event => {
    if (event.target.closest("button,input")) return;
    holdTimer = setTimeout(() => {
      holding = voiceController.start();
    }, 360);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(type => surface.addEventListener(type, stop));
}

function insertSpaceAtCursor(input) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(" ", start, end, "end");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function bindDesktopSpaceToTalk(input) {
  let holdTimer = null;
  let holding = false;
  input.addEventListener("keydown", event => {
    if (event.code !== "Space" || document.activeElement !== chatInput || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    if (event.repeat || holdTimer || holding) return;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      holding = voiceController.start();
    }, 360);
  });
  input.addEventListener("keyup", event => {
    if (event.code !== "Space" || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      insertSpaceAtCursor(input);
    } else if (holding) {
      holding = false;
      voiceController.stop();
    }
  });
  input.addEventListener("blur", () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (holding) voiceController.stop();
    holding = false;
  });
}
bindHoldToTalk($("#chat-form"));
bindDesktopSpaceToTalk(chatInput);

$("#clock").textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
$("#today-date").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
const initialScreen = new URLSearchParams(location.search).get("screen");
if (["chat", "today", "path", "us", "settings"].includes(initialScreen)) openScreen(initialScreen);
syncVisualViewport();
resizeComposer();
render();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(() => {});
