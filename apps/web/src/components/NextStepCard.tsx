import type { LegacyAction } from "../adapters/legacy-app-store";
import type { StatefulComponentProps } from "./types";
import { GlassCard } from "./GlassCard";
import styles from "./NextStepCard.module.css";

export interface NextStepCardProps extends StatefulComponentProps {
  action: LegacyAction | null;
  onDiscuss?: () => void;
  onStart?: () => void;
}

export function NextStepCard({ action, className = "", onDiscuss, onStart, state = "default" }: NextStepCardProps) {
  if (!action) {
    return <GlassCard className={`${styles.card} ${className}`.trim()} state={state}>
      <span className={styles.kicker}><i />下一步</span>
      <h2>还不急着替你安排。</h2>
      <p>先和小程说说现在的状态、想做的事或可用时间，再一起找到值得做的一小步。</p>
      <button className={styles.primary} onClick={onDiscuss} type="button">从一次对话开始 <span>→</span></button>
    </GlassCard>;
  }

  const minutes = Number.isFinite(action.duration_minutes) ? `${action.duration_minutes} 分钟` : "一小步";
  return <GlassCard className={`${styles.card} ${className}`.trim()} state={state}>
    <span aria-hidden="true" className={styles.mist} />
    <div className={styles.content}>
      <span className={styles.kicker}><i />下一步</span>
      <h2>{action.title || "从这一小步开始"}</h2>
      <p>{action.why_now || "基于你已经确认的方向，先把眼前这一步做好。"}</p>
      <div className={styles.footer}><span>◷ {minutes}</span><button className={styles.primary} disabled={state === "disabled" || state === "loading"} onClick={onStart} type="button">开始学习 <b>→</b></button></div>
      <button className={styles.discuss} onClick={onDiscuss} type="button">和小程讨论这个任务 <b>›</b></button>
    </div>
  </GlassCard>;
}
