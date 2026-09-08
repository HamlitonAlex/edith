import { adoptPlan, createPlan, planToMarkdown, reviseTimeBudget, validateBrief } from "/lib/plan-generator.js";
const $ = (selector) => document.querySelector(selector);
const form = $("#brief-form");
const sheet = $("#plan-sheet");
const empty = $("#empty-plan");
const storageKey = "xuecheng:current-plan:v1";
let plan = loadPlan();
function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function loadPlan() { try { return JSON.parse(localStorage.getItem(storageKey)) || null; } catch { return null; } }
function savePlan() { localStorage.setItem(storageKey, JSON.stringify(plan)); }
function toast(message) { const node = $("#toast"); node.textContent = message; node.hidden = false; window.setTimeout(() => { node.hidden = true; }, 2400); }
function briefFromForm() { return Object.fromEntries(new FormData(form).entries()); }
function showErrors(errors) { for (const node of document.querySelectorAll("[data-error]")) node.textContent = errors[node.dataset.error] || ""; }
function statusLabel(current) { if (current.status === "active") return `当前执行版 · 第 ${current.version} 版`; if (current.status === "discussion") return "家庭讨论稿 · 孩子意见尚未确认"; return "方案讨论稿 · 尚未采用"; }
function renderPlan() {
  if (!plan) { empty.hidden = false; sheet.hidden = true; return; }
  empty.hidden = true; sheet.hidden = false; $("#plan-status").textContent = statusLabel(plan); $("#plan-title").textContent = `${plan.subject}的学习方案`; $("#plan-direction").textContent = plan.direction;
  $("#plan-facts").innerHTML = `<div><span>当前起点</span><strong>${escapeHtml(plan.baseline)}</strong></div><div><span>每周时间</span><strong>${plan.weeklyMinutes} 分钟</strong></div><div><span>现实限制</span><strong>${escapeHtml(plan.constraints)}</strong></div>`;
  $("#plan-stages").innerHTML = plan.stages.map((stage) => `<article class="stage"><h3>${escapeHtml(stage.title)}</h3><p>${escapeHtml(stage.purpose)}</p><small>进入下一阶段：${escapeHtml(stage.gate)}</small></article>`).join("");
  $("#plan-actions-list").innerHTML = plan.currentActions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#plan-evidence").innerHTML = plan.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join(""); $("#plan-risks").innerHTML = [...plan.assumptions, ...plan.risks].map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#adopt-plan").hidden = plan.status === "active"; $("#adopt-plan").textContent = plan.status === "discussion" ? "孩子确认后才能采用" : "采用这份方案"; $("#adopt-plan").disabled = plan.status === "discussion";
  $("#revision-box").hidden = plan.status !== "active"; $("#revision-minutes").value = plan.weeklyMinutes;
}
function syncMode() { const family = form.elements.mode.value === "family"; $("#voice-choice").hidden = !family; $("#learner-label").textContent = family ? "孩子的称呼" : "你的称呼（选填）"; form.elements.learnerName.required = family; }
form.addEventListener("change", (event) => { if (event.target.name === "mode") syncMode(); });
form.addEventListener("submit", (event) => { event.preventDefault(); const brief = briefFromForm(); const validation = validateBrief(brief); showErrors(validation.errors); if (!validation.valid) { toast("还有会影响方案的关键信息没有填写"); return; } plan = createPlan(brief); savePlan(); renderPlan(); sheet.scrollIntoView({ behavior:"smooth", block:"start" }); });
$("#adopt-plan").addEventListener("click", () => { plan = adoptPlan(plan); savePlan(); renderPlan(); toast("第 1 版已采用，后续修订会保留历史"); });
$("#revision-form").addEventListener("submit", (event) => { event.preventDefault(); plan = reviseTimeBudget(plan, $("#revision-minutes").value); savePlan(); renderPlan(); toast(`已采用第 ${plan.version} 版，旧版仍在历史中`); });
$("#export-plan").addEventListener("click", () => { const blob = new Blob([planToMarkdown(plan)], { type:"text/markdown;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `学程-${plan.subject}-第${plan.version}版.md`; link.click(); URL.revokeObjectURL(link.href); toast("方案已导出"); });
$("#fill-example").addEventListener("click", () => { form.elements.mode.value = "personal"; syncMode(); form.elements.learnerName.value = "Alex"; form.elements.goal.value = "独立完成一份数据周报，并向同事解释关键指标变化"; form.elements.currentState.value = "会使用基础表格公式，但面对缺失数据和图表选择时容易卡住"; form.elements.weeklyMinutes.value = 120; form.elements.constraints.value = "工作日可能加班，不希望连续学习超过 45 分钟"; form.elements.interests.value = "使用接近真实工作的销售数据"; showErrors({}); });
syncMode(); renderPlan();
