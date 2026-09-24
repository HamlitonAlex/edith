import { useMemo, useState } from "react";
import type { LegacyAppSnapshot, LegacyCalendarEvent, LegacyRuntimePort, RuntimeSnapshot } from "../../adapters";
import { BottomNav, GlassCard, ScheduleRow } from "../../components";
import styles from "./SchedulePage.module.css";

const navigation = [{ id: "home", label: "首页", icon: "⌂" }, { id: "conversation", label: "对话", icon: "◌" }, { id: "schedule", label: "日程", icon: "□" }, { id: "profile", label: "我的", icon: "♙" }] as const;
const dateKey = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
const eventDate = (event: LegacyCalendarEvent) => {
  const raw = String(event.start || "");
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})T/);
  return compact ? compact[1] + "-" + compact[2] + "-" + compact[3] : "";
};
function selectedDate(snapshot: RuntimeSnapshot | LegacyAppSnapshot) {
  const value = (snapshot as RuntimeSnapshot).calendarDate;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

export function SchedulePage({ snapshot, onNavigate, runtime }: { snapshot: RuntimeSnapshot | LegacyAppSnapshot; runtime: LegacyRuntimePort | null; onNavigate: (page: string) => void }) {
  const [manualTitle, setManualTitle] = useState("");
  const [manualStart, setManualStart] = useState("");
  const selected = selectedDate(snapshot);
  const selectedKey = dateKey(selected);
  const week = useMemo(() => {
    const monday = new Date(selected);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      return day;
    });
  }, [selectedKey]);
  const dayEvents = snapshot.preferences.calendarEvents.filter(event => !eventDate(event) || eventDate(event) === selectedKey);
  const confirmed = dayEvents.filter(event => event.status !== "pending").sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
  const pending = dayEvents.filter(event => event.status === "pending");
  const action = snapshot.agent.next_recommended_action;
  const shiftDate = (amount: number) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + amount * 7);
    runtime?.setCalendarDate(dateKey(next));
  };
  const saveSchedule = () => {
    const title = manualTitle.trim();
    if (!title || !manualStart) return;
    runtime?.createSchedule(title, manualStart);
    setManualTitle("");
    setManualStart("");
  };

  return <main className={styles.page} aria-label="日程">
    <header><small>我的日程</small><h1>把今天留给重要的事</h1><p>已确认安排和等待确认的建议会分开显示。</p></header>
    <div className={styles.week} aria-label="本周日期"><button aria-label="上一周" onClick={() => shiftDate(-1)} type="button">‹</button>{week.map(day => {
      const key = dateKey(day);
      return <button aria-current={key === selectedKey ? "date" : undefined} className={key === selectedKey ? styles.active : ""} key={key} onClick={() => runtime?.setCalendarDate(key)} type="button"><small>{"日一二三四五六"[day.getDay()]}</small><b>{day.getDate()}</b></button>;
    })}<button aria-label="下一周" onClick={() => shiftDate(1)} type="button">›</button></div>
    <div className={styles.actions}><button onClick={() => runtime?.importCalendar()} type="button">导入日历 (.ics)</button><details><summary>手动添加</summary><div><input aria-label="日程名称" maxLength={100} onChange={event => setManualTitle(event.target.value)} placeholder="事项名称" value={manualTitle} /><input aria-label="日程时间" onChange={event => setManualStart(event.target.value)} type="datetime-local" value={manualStart} /><button disabled={!manualTitle.trim() || !manualStart} onClick={saveSchedule} type="button">保存到我的日程</button></div></details></div>
    <section><div className={styles.heading}><h2>已确认日程</h2><small>{selected.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</small></div><GlassCard className={styles.timeline}>{confirmed.length ? confirmed.map(event => <ScheduleRow event={event} key={event.id || event.start} />) : <ScheduleRow />}</GlassCard></section>
    {pending.length ? <section><div className={styles.heading}><h2>待确认</h2><small>尚未进入正式日程</small></div><GlassCard className={styles.timeline}>{pending.map(event => <ScheduleRow event={event} key={event.id || event.start} />)}</GlassCard></section> : null}
    {action ? <section><div className={styles.heading}><h2>AI 建议</h2><small>等你决定</small></div><GlassCard className={styles.suggestion}><span>建议 · 尚未写入日程</span><h2>{action.title || "下一步安排"}</h2><p>{action.why_now || "这是一个等待你确认的建议。"}</p><div><button onClick={() => { runtime?.discussAction(); onNavigate("conversation"); }} type="button">和小程聊聊</button><button onClick={() => runtime?.confirmSuggestion()} type="button">确认安排</button><button onClick={() => runtime?.rejectSuggestion()} type="button">暂不安排</button></div></GlassCard></section> : null}
    <BottomNav activeId="schedule" items={navigation} onChange={onNavigate} />
  </main>;
}
