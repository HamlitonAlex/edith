import type { LegacyMessage } from "../adapters";
import type { StatefulComponentProps } from "./types";
import styles from "./ChatBubble.module.css";

export function ChatBubble({ message, state = "default" }: StatefulComponentProps & { message: LegacyMessage }) {
  const mine = message.role === "user";
  const parts = String(message.text || "").split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\n)/g).filter(Boolean);
  return <article className={`${styles.bubble} ${mine ? styles.mine : styles.companion}`} data-state={state}>
    {!mine ? <img alt="" src="/assets/xuecheng-mark.svg" /> : null}
    <div><p>{parts.map((part, index) => part === "\n" ? <br key={index} /> : part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith("*") && part.endsWith("*") ? <em key={index}>{part.slice(1, -1)}</em> : part.startsWith("`") && part.endsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part)}</p>{message.attachments?.length ? <small>{message.attachments.map((item, index) => <span key={item.name + "-" + index}>{item.name || "附件"}{index < (message.attachments?.length || 0) - 1 ? " · " : ""}</span>)}</small> : null}{message.createdAt ? <time>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time> : null}</div>
  </article>;
}
