const storageKey = "xuecheng:iphone:v2";
const defaultAvatar = "./assets/companion-default.png";
const defaults = { name: "小程", theme: "citrus", role: "guide", initiative: .65, avatar: defaultAvatar, messages: [], planAdopted: false };
const legacyThemes = { apricot: "citrus", sage: "meadow", plum: "berry" };
const themeColors = { citrus: "#f6c56a", meadow: "#dce8bd", berry: "#efc9cf", dusk: "#d9c9e8" };
const roleCopy = {
  guide: "她会像一位了解你的引路人，给建议，也会指出你正在回避的问题。",
  friend: "她会像一个长期了解你的朋友，先理解你，再陪你把事情想清楚。",
  family: "她会像家人一样关心你的生活基础，同时尊重你的选择。",
  partner: "她会以亲密伙伴的方式陪伴、讨论和共同规划，但不会替你决定人生。"
};

const $ = selector => document.querySelector(selector);
let toastTimer;
let state = load();
const screenOrder = ["chat", "today", "path", "us"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let screenAnimations = [];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("xuecheng:iphone:v1") || "{}");
    return { ...defaults, ...saved, theme: legacyThemes[saved.theme] || saved.theme || defaults.theme, avatar: defaultAvatar };
  } catch {
    return { ...defaults };
  }
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
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

function render() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[state.theme] || themeColors.citrus);
  document.querySelectorAll("[data-name]").forEach(node => { node.textContent = state.name; });
  document.querySelectorAll("[data-avatar]").forEach(node => { node.src = defaultAvatar; });
  $("#companion-name").value = state.name;
  $("#initiative").value = state.initiative;
  $("#initiative-value").textContent = `${Math.round(state.initiative * 100)}%`;
  $("#relationship-copy").textContent = roleCopy[state.role];
  document.querySelectorAll("[data-role]").forEach(button => button.classList.toggle("active", button.dataset.role === state.role));
  document.querySelectorAll("[data-theme-option]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.themeOption === state.theme)));
  $("#dynamic-messages").innerHTML = state.messages.map(message => message.role === "user"
    ? `<article class="message user-message"><div><p>${escapeHtml(message.text)}</p><time>刚刚</time></div></article>`
    : `<article class="message companion-message"><img src="${defaultAvatar}" alt=""><div><p>${escapeHtml(message.text)}</p><time>刚刚</time></div></article>`).join("");
  const planButton = $("#adopt-plan");
  planButton.textContent = state.planAdopted ? "已加入今天" : "接受这个安排";
  planButton.disabled = state.planAdopted;
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
    const active = button.dataset.nav === name;
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
  state.messages.push({ role: "user", text });
  state.messages.push({ role: "assistant", text: "我先记下，不急着给结论。你希望我现在帮你做决定，还是先陪你把这件事想清楚？" });
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

$("#adopt-plan").addEventListener("click", () => {
  state.planAdopted = true;
  save();
  render();
  showToast("已经加入今天，17:45 我会先确认你的精力");
  setTimeout(() => openScreen("today"), 550);
});

$("#companion-name").addEventListener("change", event => {
  state.name = event.target.value.trim() || "小程";
  save();
  render();
  showToast(`以后就叫她“${state.name}”`);
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
voiceButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  if (!Recognition) {
    showToast("当前环境暂不支持语音，请先用文字告诉她");
    return;
  }
  voiceButton.classList.add("listening");
  showToast("正在听，松开结束");
  recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.onresult = result => { $("#chat-input").value = result.results[0][0].transcript; };
  recognition.onend = () => voiceButton.classList.remove("listening");
  recognition.onerror = () => { voiceButton.classList.remove("listening"); showToast("没有听清，可以再按一次"); };
  recognition.start();
});
["pointerup", "pointercancel", "pointerleave"].forEach(type => voiceButton.addEventListener(type, () => recognition?.stop()));

$("#clock").textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
$("#today-date").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
const initialScreen = new URLSearchParams(location.search).get("screen");
if (["chat", "today", "path", "us"].includes(initialScreen)) openScreen(initialScreen);
syncVisualViewport();
resizeComposer();
render();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(() => {});
