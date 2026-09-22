import { useState } from "react";
import type { StatefulComponentProps } from "./types";
import styles from "./ChatInputBar.module.css";

export type ChatInputState = "idle" | "focused" | "typing" | "multiline" | "recording" | "recognizing" | "recognized" | "failed";
export interface ChatInputBarProps extends Omit<StatefulComponentProps, "state"> { inputState?: ChatInputState; onSubmit?: (text: string) => void; }

/** Presentation shell; real speech capture remains supplied by the existing native bridge. */
export function ChatInputBar({ className = "", inputState = "idle", onSubmit }: ChatInputBarProps) {
  const [draft, setDraft] = useState("");
  const derived = inputState === "idle" && draft ? (draft.includes("\n") ? "multiline" : "typing") : inputState;
  const submit = () => { const text = draft.trim(); if (!text) return; onSubmit?.(text); setDraft(""); };
  return <form aria-label="发送消息" className={`${styles.bar} ${className}`.trim()} data-state={derived} onSubmit={event => { event.preventDefault(); submit(); }}>
    <button aria-label="添加照片或文件" className={styles.icon} type="button">＋</button>
    <textarea aria-label="和小程说说现在的想法" onChange={event => setDraft(event.target.value)} placeholder="和小程说说现在的想法……" rows={1} value={draft} />
    {draft ? <button aria-label="发送" className={styles.send} type="submit">↑</button> : <button aria-label="按住说话" className={styles.icon} data-voice-state={derived} type="button">◉</button>}
    {derived === "recording" || derived === "recognizing" ? <span className={styles.voiceStatus}>{derived === "recording" ? "正在听" : "正在识别"}</span> : null}
  </form>;
}
