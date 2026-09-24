import type { LegacyCalendarEvent } from "../adapters/legacy-app-store";
import type { StatefulComponentProps } from "./types";
import styles from "./ScheduleRow.module.css";

function timeOf(event: LegacyCalendarEvent) {
  const match = String(event.start || "").match(/T(\d{2})(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "待定";
}

export function ScheduleRow({ event, state = "default" }: StatefulComponentProps & { event?: LegacyCalendarEvent }) {
  if (!event) return <div className={styles.empty} data-state={state}>今天还没有已确认日程。</div>;
  const status = event.status || "confirmed";
  return <article className={styles.row} data-state={state}>
    <time>{timeOf(event)}</time><span className={`${styles.node} ${styles[status]}`} aria-hidden="true" />
    <div><strong>{event.summary || "未命名安排"}</strong><small>{status === "pending" ? "等待你确认" : status === "completed" ? "已完成" : "已确认安排"}</small></div>
  </article>;
}
