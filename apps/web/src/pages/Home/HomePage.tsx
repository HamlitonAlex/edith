import type { LegacyAppSnapshot } from "../../adapters";
import { BottomNav, GlassCard, NextStepCard, ScheduleRow } from "../../components";
import styles from "./HomePage.module.css";

const navigation = [
  { id: "home", label: "首页", icon: "⌂" }, { id: "conversation", label: "对话", icon: "◌" },
  { id: "schedule", label: "日程", icon: "□" }, { id: "profile", label: "我的", icon: "♙" },
] as const;

export interface HomePageProps { snapshot: LegacyAppSnapshot; state?: "default" | "loading" | "error"; onNavigate: (page: string) => void; }

function greeting() { const hour = new Date().getHours(); return hour < 11 ? "早上好，" : hour < 18 ? "下午好，" : "晚上好，"; }

export function HomePage({ onNavigate, snapshot, state = "default" }: HomePageProps) {
  const action = snapshot.agent.next_recommended_action;
  const event = snapshot.preferences.calendarEvents.find(item => item.status !== "pending");
  const goal = snapshot.agent.long_term_goals[0]?.text;
  const activeSkills = Object.values(snapshot.agent.skills).filter(skill => (skill.evidence?.length || 0) > 0);
  return <main className={styles.page} aria-label="首页">
    <header className={styles.brandHeader}><div className={styles.brand}><img alt="" src="/assets/xuecheng-mark.svg" /><span><b>学程</b><small>陪你，走更远的路</small></span></div><button aria-label="和小程聊聊" className={styles.companion} onClick={() => onNavigate("conversation")} type="button"><img alt="" src="/assets/xuecheng-mark.svg" /><small>和小程聊聊</small></button></header>
    <section className={styles.greeting}><small>{greeting()}</small><h1>你。</h1><p>今天也在靠近更好的自己。</p></section>
    <NextStepCard action={action} onDiscuss={() => onNavigate("conversation")} onStart={() => onNavigate("conversation")} state={state} />
    <section className={styles.section} aria-labelledby="today-heading"><div className={styles.heading}><h2 id="today-heading">今日安排</h2><button onClick={() => onNavigate("schedule")} type="button">查看全部 ›</button></div><GlassCard className={styles.scheduleCard} state={state}><ScheduleRow event={event} state={state} /></GlassCard></section>
    <button className={styles.pathSummary} onClick={() => onNavigate("path")} type="button"><span className={styles.pathIcon}>⌁</span><span><small>我的学习路径</small><b>{goal || "从真实的目标慢慢长出来"}</b><em>{goal ? `${activeSkills.length} 个正在积累的证据` : "不预设方向，也不替你定义。"}</em></span><strong>›</strong></button>
    <BottomNav activeId="home" items={navigation} onChange={onNavigate} state={state} />
  </main>;
}
