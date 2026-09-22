import type { LegacyAppSnapshot } from "../../adapters";
import { BottomNav, GlassCard, ScheduleRow } from "../../components";
import styles from "./SchedulePage.module.css";

const navigation = [{ id: "home", label: "首页", icon: "⌂" }, { id: "conversation", label: "对话", icon: "◌" }, { id: "schedule", label: "日程", icon: "□" }, { id: "profile", label: "我的", icon: "♙" }] as const;
export function SchedulePage({ snapshot, onNavigate }: { snapshot: LegacyAppSnapshot; onNavigate: (page: string) => void }) {
  const confirmed = snapshot.preferences.calendarEvents.filter(event => event.status !== "pending");
  const action = snapshot.agent.next_recommended_action;
  return <main className={styles.page} aria-label="日程"><header><small>我的日程</small><h1>把今天留给重要的事</h1><p>日历里的安排属于你；学程的建议会先说明，再由你确认。</p></header><div className={styles.week} aria-label="本周日期"><button type="button">‹</button>{["一", "二", "三", "四", "五", "六", "日"].map((day, index) => <span className={index === 0 ? styles.active : ""} key={day}><small>{day}</small><b>{22 + index}</b></span>)}<button type="button">›</button></div><section><div className={styles.heading}><h2>已确认日程</h2><small>你的安排</small></div><GlassCard className={styles.timeline}>{confirmed.length ? confirmed.map(event => <ScheduleRow event={event} key={event.id || event.start} />) : <ScheduleRow />}</GlassCard></section>{action ? <section><div className={styles.heading}><h2>AI 建议</h2><small>等待你确认</small></div><GlassCard className={styles.suggestion}><span>建议 · 尚未写入日程</span><h2>{action.title || "下一步安排"}</h2><p>{action.why_now || "这是一个等待你确认的建议。"}</p><div><button onClick={() => onNavigate("conversation")} type="button">和小程聊聊</button><button type="button">确认安排</button></div></GlassCard></section> : null}<BottomNav activeId="schedule" items={navigation} onChange={onNavigate} /></main>;
}
