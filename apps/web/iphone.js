import { createAgentState, hydrateAgentState, runAgentTurn } from "./agent/index.js";
import { createEncryptedBackup, readEncryptedBackup } from "./local-backup.js";

const storageKey = "xuecheng:iphone:v2";
const agentStorageKey = "xuecheng:agent:v1";
const defaultAvatar = "./assets/xuecheng-mark.svg";
const legacyDefaultAvatar = "./assets/companion-default.png";
const defaults = { name: "小程", theme: "citrus", role: "guide", gender: "female", initiative: .65, avatar: defaultAvatar, messages: [], currentConversationModel: "local", quietStart: "23:00", quietEnd: "07:30", urgentOverride: true };
const legacyThemes = { apricot: "citrus", sage: "meadow", plum: "berry" };
const themeColors = { citrus: "#fbe8bb", meadow: "#f0eee2", berry: "#f5e7df", dusk: "#eee8e8", elegant: "#faf6ee", silver: "#e1e7e4" };
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
const screenOrder = ["chat", "today", "path", "us", "settings"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let screenAnimations = [];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("xuecheng:iphone:v1") || "{}");
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

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
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
  $("#today-agenda").innerHTML = action ? `<li class="next"><time>下一步<small>${action.duration_minutes} 分钟</small></time><div><small>${escapeHtml(action.platform)} · ${escapeHtml(agentState.skills[action.skill_id]?.label || "当前方向")}</small><h2>${escapeHtml(action.title)}</h2><p><b>动作：</b>${escapeHtml(action.instructions)}</p><p><b>做到什么算完成：</b>${escapeHtml(action.completion_criteria)}</p><p class="growth-trace"><b>为什么现在：</b>${escapeHtml(action.why_now)}</p><div class="agenda-actions"><button type="button" data-start-current>${action.resource?.url ? `打开${escapeHtml(action.platform)}并开始` : "开始讲解"}</button><button type="button" data-discuss="这个安排哪里不适合我？">和${pronoun}讨论</button></div></div><span>现在最值得推进</span></li>` : "";
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[state.theme] || themeColors.citrus);
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
  document.querySelectorAll("[data-theme-option]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.themeOption === state.theme)));
  $("#quiet-start").value = state.quietStart;
  $("#quiet-end").value = state.quietEnd;
  $("#urgent-override").checked = state.urgentOverride;
  $("#model-summary").textContent = state.currentConversationModel === "local" ? "本地判断" : state.currentConversationModel;
  $("#conversation-model").textContent = state.currentConversationModel === "local" ? "本地判断" : state.currentConversationModel;
  $("#dynamic-messages").innerHTML = state.messages.map(message => message.role === "user"
    ? `<article class="message user-message"><div><p>${escapeHtml(message.text)}</p><time>刚刚</time></div></article>`
    : `<article class="message companion-message"><img src="${escapeHtml(state.avatar)}" alt=""><div><p>${escapeHtml(message.text)}</p><time>刚刚</time></div></article>`).join("");
  $("#empty-conversation").hidden = state.messages.length > 0 || Boolean(agentState.next_recommended_action);
  renderToday(pronoun);
  renderPath();
  $("#reset-avatar").hidden = state.avatar === defaultAvatar;
  const action = agentState.next_recommended_action;
  $("#agent-proposal").hidden = !action;
  $("#agent-proposal").classList.toggle("external", Boolean(action?.resource?.url));
  if (action) {
    $("#proposal-time").textContent = `${action.duration_minutes} 分钟`;
    $("#proposal-platform").textContent = `${action.platform} · ${agentState.skills[action.skill_id]?.label || "当前方向"}`;
    $("#proposal-title").textContent = action.title;
    $("#proposal-why").textContent = action.why_now;
    $("#proposal-instructions").textContent = action.instructions;
    $("#proposal-completion").textContent = action.completion_criteria;
    const start = $("#start-action");
    start.textContent = action.resource?.url ? `打开${action.platform}并开始` : "开始讲解";
    start.disabled = action.status === "accepted";
    $("#discuss-action").textContent = `和${pronoun}讨论`;
  }
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

$("#chat-form").addEventListener("submit", event => {
  event.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text) {
    showToast("先说一句你现在最想解决的事");
    input.focus();
    return;
  }
  $("#agent-proposal").classList.remove("discussing");
  state.messages.push({ role: "user", text });
  const agentResult = runAgentTurn(agentState, text);
  agentState = agentResult.state;
  state.messages.push({ role: "assistant", text: agentResult.reply, kind: agentResult.kind });
  input.value = "";
  resizeComposer();
  save();
  render();
  const recent = [...document.querySelectorAll("#dynamic-messages .message")].slice(-2);
  recent.forEach((message, index) => {
    message.style.setProperty("--enter-delay", `${index * 70}ms`);
    if (!reduceMotion.matches) message.classList.add("message-enter");
  });
  requestAnimationFrame(() => $("#dynamic-messages").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "end" }));
});

let pendingExternalUrl = "";
let leftForExternalAction = false;

function acceptCurrentAction() {
  if (!agentState.next_recommended_action) return null;
  const result = runAgentTurn(agentState, "接受这个安排，现在开始");
  agentState = result.state;
  state.messages.push({ role: "assistant", text: result.reply, kind: result.kind });
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
  state.messages.push({ role: "assistant", text: action ? `可以。先不急着执行。${action.title}这件事里，是时间、内容、方式，还是我对“为什么现在”的判断让你觉得不合适？` : "可以，我们一起调整。你最想先改变哪一部分？" });
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
  state.messages.push({ role: "assistant", text: "你回来了。刚才看到哪里？不用总结，随口说一句最让你停顿或意外的地方就行。", kind: "follow-up" });
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
    showToast(`安静时段：${state.quietStart}—${state.quietEnd}`);
  });
});

$("#conversation-model").addEventListener("click", () => $("#model-dialog").showModal());

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
chatInput.addEventListener("input", resizeComposer);
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
const voiceButton = $("#voice-button");
let recognition = null;
function bindHoldToTalk(surface) {
  let holdTimer = null;
  let holding = false;
  let confidence = 0;
  const stop = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (!holding) return;
    holding = false;
    recognition?.stop();
  };
  surface.addEventListener("pointerdown", event => {
    if (event.target.closest(".send-button")) return;
    holdTimer = setTimeout(() => {
      if (!Recognition) {
        showToast("当前环境暂不支持语音，请先用文字告诉她");
        return;
      }
      holding = true;
      surface.classList.add("listening");
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
        surface.classList.remove("listening");
        if (chatInput.value.trim() && confidence >= .72) surface.requestSubmit();
        else if (chatInput.value.trim()) showToast("我不太确定是否听准了，你看一眼再发送");
      };
      recognition.onerror = () => { surface.classList.remove("listening"); showToast("没有听清，可以再长按一次"); };
      recognition.start();
      navigator.vibrate?.(18);
    }, 360);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(type => surface.addEventListener(type, stop));
}
bindHoldToTalk($("#chat-form"));

$("#clock").textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
$("#today-date").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
const initialScreen = new URLSearchParams(location.search).get("screen");
if (["chat", "today", "path", "us", "settings"].includes(initialScreen)) openScreen(initialScreen);
syncVisualViewport();
resizeComposer();
render();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(() => {});
