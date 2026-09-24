import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { RuntimeVoiceState } from "../adapters/legacy-runtime-adapter";
import type { StatefulComponentProps } from "./types";
import styles from "./ChatInputBar.module.css";

export type ChatInputState = "idle" | "focused" | "typing" | "multiline" | "recording" | "recognizing" | "recognized" | "failed";
export interface ChatInputBarProps extends Omit<StatefulComponentProps, "state"> {
  inputState?: ChatInputState;
  onSubmit?: (text: string) => boolean | void;
  voiceState?: RuntimeVoiceState;
  voiceTranscript?: string;
  sending?: boolean;
  attachments?: Array<{ name: string; type: string }>;
  onVoiceStart?: () => boolean;
  onVoiceStop?: () => void;
  onVoiceCancel?: () => void;
  onAddAttachment?: (source: "photo" | "camera" | "file") => void;
  onPasteText?: (text: string) => void;
  onRemoveAttachment?: (index: number) => void;
}

/** Product composer; speech capture and message persistence are supplied by the existing runtime adapter. */
export function ChatInputBar({
  attachments = [],
  className = "",
  inputState = "idle",
  onAddAttachment,
  onPasteText,
  onRemoveAttachment,
  onSubmit,
  onVoiceCancel,
  onVoiceStart,
  onVoiceStop,
  sending = false,
  voiceState = "idle",
  voiceTranscript = "",
}: ChatInputBarProps) {
  const [draft, setDraft] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const pasteDialog = useRef<HTMLDialogElement>(null);
  const holdTimer = useRef<number | null>(null);
  const holdStarted = useRef(false);
  const cancelOnRelease = useRef(false);
  const ignoreClick = useRef(false);
  const pressY = useRef(0);
  const derivedVoice: ChatInputState = voiceState === "requesting" || voiceState === "recording" ? "recording"
    : voiceState === "recognizing" ? "recognizing"
      : voiceState === "success" ? "recognized"
        : voiceState === "failure" ? "failed" : inputState;
  const derived = derivedVoice === "idle" && inputState === "idle" && draft ? (draft.includes("\n") ? "multiline" : "typing") : derivedVoice;

  useEffect(() => {
    if (voiceState === "success" && voiceTranscript.trim()) setDraft(voiceTranscript);
  }, [voiceState, voiceTranscript]);

  useEffect(() => {
    if (pasteOpen && !pasteDialog.current?.open) pasteDialog.current?.showModal();
  }, [pasteOpen]);

  const submit = () => {
    const text = draft.trim();
    if (!text || sending) return;
    const accepted = onSubmit?.(text);
    if (accepted !== false) setDraft("");
  };
  const clearHoldTimer = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const releaseVoice = () => {
    clearHoldTimer();
    if (!holdStarted.current) return;
    holdStarted.current = false;
    ignoreClick.current = true;
    if (cancelOnRelease.current) onVoiceCancel?.();
    else onVoiceStop?.();
  };
  const startPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (draft.trim()) return;
    pressY.current = event.clientY;
    cancelOnRelease.current = false;
    holdStarted.current = false;
    clearHoldTimer();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional on older browsers */ }
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      holdStarted.current = Boolean(onVoiceStart?.());
    }, 260);
  };
  const trackPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (holdStarted.current && pressY.current - event.clientY > 54) cancelOnRelease.current = true;
  };
  const cancelPress = () => {
    clearHoldTimer();
    if (holdStarted.current) onVoiceCancel?.();
    holdStarted.current = false;
  };
  const voiceStatus = derived === "recording" ? "正在听"
    : derived === "recognizing" ? "正在识别"
      : derived === "recognized" ? "已转成文字"
        : derived === "failed" ? "语音暂不可用" : "";

  return <form aria-label="发送消息" className={(styles.bar + " " + className).trim()} data-state={derived} onSubmit={event => { event.preventDefault(); submit(); }}>
    {attachments.length ? <div className={styles.attachments}>{attachments.map((attachment, index) => <span className={styles.attachment} key={attachment.name + "-" + index}><span>{attachment.name}</span><button aria-label={"移除" + attachment.name} onClick={() => onRemoveAttachment?.(index)} type="button">×</button></span>)}</div> : null}
    <div className={styles.attachmentMenu}>
      <button aria-expanded={attachmentOpen} aria-label="添加照片、文件或文字" className={styles.icon} onClick={() => setAttachmentOpen(open => !open)} type="button">＋</button>
      {attachmentOpen ? <div className={styles.attachmentOptions}>
        <button onClick={() => { onAddAttachment?.("camera"); setAttachmentOpen(false); }} type="button">拍照</button>
        <button onClick={() => { onAddAttachment?.("photo"); setAttachmentOpen(false); }} type="button">选择照片</button>
        <button onClick={() => { onAddAttachment?.("file"); setAttachmentOpen(false); }} type="button">选择文件</button>
        <button onClick={() => { setPastedText(""); setPasteOpen(true); setAttachmentOpen(false); }} type="button">粘贴文字</button>
      </div> : null}
    </div>
    <textarea aria-label="和小程说说现在的想法" disabled={sending} onChange={event => setDraft(event.target.value)} placeholder="和小程说说现在的想法……" rows={1} value={draft} />
    {draft.trim() ? <button aria-label="发送" className={styles.send} disabled={sending} type="submit">{sending ? "…" : "↑"}</button> : <button
      aria-label="按住说话"
      className={styles.icon}
      data-voice-state={derived}
      onClick={() => {
        if (ignoreClick.current) { ignoreClick.current = false; return; }
        if (voiceState === "recording" || voiceState === "requesting") onVoiceStop?.();
        else if (voiceState === "recognizing") onVoiceCancel?.();
        else onVoiceStart?.();
      }}
      onPointerCancel={cancelPress}
      onPointerDown={startPress}
      onPointerMove={trackPress}
      onPointerUp={releaseVoice}
      type="button"
    >◉</button>}
    {voiceStatus ? <span className={styles.voiceStatus} role="status">{voiceStatus}{derived === "recording" ? " · 松开转写，上滑取消" : derived === "recognized" ? " · 可编辑后发送" : derived === "failed" ? " · 请重试或键盘输入" : "…"}</span> : null}
    <dialog className={styles.pasteDialog} onClose={() => setPasteOpen(false)} ref={pasteDialog}>
      <small>补充当前对话</small><h2>粘贴一段文字</h2>
      <textarea aria-label="粘贴的文字" onChange={event => setPastedText(event.target.value)} placeholder="笔记、聊天内容、网页片段……" value={pastedText} />
      <div><button onClick={() => pasteDialog.current?.close()} type="button">取消</button><button disabled={!pastedText.trim()} onClick={() => { onPasteText?.(pastedText); pasteDialog.current?.close(); }} type="button">加入对话</button></div>
    </dialog>
  </form>;
}
