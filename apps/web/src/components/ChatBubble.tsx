import type { LegacyMessage } from "../adapters";
import type { StatefulComponentProps } from "./types";
import styles from "./ChatBubble.module.css";

export function ChatBubble({ message, state = "default" }: StatefulComponentProps & { message: LegacyMessage }) {
  const mine = message.role === "user";
  return <article className={`${styles.bubble} ${mine ? styles.mine : styles.companion}`} data-state={state}>
    {!mine ? <img alt="" src="/assets/xuecheng-mark.svg" /> : null}
    <div><p>{message.text || ""}</p>{message.createdAt ? <time>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time> : null}</div>
  </article>;
}
