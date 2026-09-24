import { useEffect, useMemo, useRef, useState } from "react";
import type { LegacyAppSnapshot, LegacyRuntimePort, RuntimeSnapshot, RuntimeVoiceState } from "../../adapters";
import { BottomNav, ChatBubble, ChatInputBar, NextStepCard } from "../../components";
import styles from "./ConversationPage.module.css";
import promptStyles from "./MemoryPrompt.module.css";

const navigation = [{ id: "home", label: "首页", icon: "⌂" }, { id: "conversation", label: "对话", icon: "◌" }, { id: "schedule", label: "日程", icon: "□" }, { id: "profile", label: "我的", icon: "♙" }] as const;
export interface ConversationPageProps {
  snapshot: RuntimeSnapshot | LegacyAppSnapshot;
  runtime: LegacyRuntimePort | null;
  onNavigate: (page: string) => void;
  voiceState: RuntimeVoiceState;
  voiceTranscript: string;
  keyboardVisible: boolean;
}

/** The visible conversation and composer are React; all turns still run through the established local-first agent/repository. */
export function ConversationPage({ keyboardVisible, onNavigate, runtime, snapshot, voiceState, voiceTranscript }: ConversationPageProps) {
  const messages = useMemo(() => snapshot.preferences.messages, [snapshot.preferences.messages]);
  const runtimeSnapshot = "conversation" in snapshot ? snapshot : null;
  const messageList = useRef<HTMLElement>(null);
  const [earlier, setEarlier] = useState<LegacyAppSnapshot["preferences"]["messages"]>([]);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const auth = runtimeSnapshot?.auth;
  const memoryPrompt = runtimeSnapshot?.memoryPrompt;
  const allMessages = useMemo(() => {
    const known = new Set(messages.map(message => message.id || message.clientMessageId).filter(Boolean));
    return [...earlier.filter(message => !known.has(message.id || message.clientMessageId || "")), ...messages];
  }, [earlier, messages]);
  useEffect(() => {
    const element = messageList.current;
    if (element && !earlier.length) element.scrollTop = element.scrollHeight;
  }, [messages.length, runtimeSnapshot?.conversation.sending, earlier.length]);
  const action = snapshot.agent.next_recommended_action;
  const sending = Boolean(runtimeSnapshot?.conversation.sending);
  const status = voiceState === "failure" ? "error" : sending || voiceState === "requesting" || voiceState === "recognizing" ? "loading" : "default";
  const startVoice = () => runtime?.startVoice() || false;
  const loadEarlier = async () => {
    const oldest = allMessages[0];
    const beforeId = oldest?.id || oldest?.clientMessageId;
    if (!runtime || !beforeId || loadingEarlier) return;
    setLoadingEarlier(true);
    setHistoryError("");
    try {
      const page = await runtime.loadEarlierMessages(beforeId, 50);
      setEarlier(current => [...page, ...current]);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "更早的对话暂时无法读取。");
    } finally { setLoadingEarlier(false); }
  };
  return <main className={styles.page} aria-label="对话" data-keyboard-open={keyboardVisible}>
    <header className={styles.header}><button aria-label="返回首页" onClick={() => onNavigate("home")} type="button">‹</button><span><h1>和小程对话</h1><small>随时聊聊你的学习与成长</small></span><button aria-label="对话设置" onClick={() => onNavigate("profile")} type="button">•••</button></header>
    <section className={styles.messages} aria-live="polite" ref={messageList}>
      {auth?.authenticated && allMessages.length >= 50 && allMessages[0]?.id ? <button className={styles.earlier} disabled={loadingEarlier} onClick={() => void loadEarlier()} type="button">{loadingEarlier ? "正在读取……" : "查看更早的对话"}</button> : null}
      {historyError ? <p className={styles.historyError} role="alert">{historyError}</p> : null}
      {!allMessages.length ? <div className={styles.empty}><img alt="" src="/assets/xuecheng-mark.svg" /><b>Hi，今天想从哪里开始？</b><p>想聊聊现在的状态，还是直接开始一件事？</p></div> : allMessages.map((message, index) => <ChatBubble key={message.clientMessageId || message.id || message.createdAt + "-" + index} message={message} />)}
      {sending ? <p aria-label="正在生成回复" className={styles.generating} role="status">正在整理你的想法……</p> : null}
      {memoryPrompt && memoryPrompt.status !== "archived" ? <aside className={promptStyles.prompt} aria-label="记忆建议">
        {memoryPrompt.status === "confirmed" ? <p>✓ 我记住了。</p> : <><p>这个目标以后会影响学习安排，要让我记住吗？</p><blockquote>{memoryPrompt.content}</blockquote><div><button onClick={() => runtime?.confirmMemory(memoryPrompt.id)} type="button">记住</button><button onClick={() => runtime?.dismissMemory(memoryPrompt.id)} type="button">暂时不用</button></div></>}
      </aside> : null}
      {action ? <NextStepCard action={action} onDiscuss={() => runtime?.discussAction()} onStart={() => runtime?.acceptAction()} /> : null}
      {import.meta.env.DEV && new URLSearchParams(location.search).get("context_debug") === "1" && runtimeSnapshot?.contextDebug ? <details className={promptStyles.debug}><summary>本次回答使用的上下文</summary><p>记忆：{runtimeSnapshot.contextDebug.memory.join("、") || "无"}；证据：{runtimeSnapshot.contextDebug.evidence.join("、") || "无"}；最近消息：{runtimeSnapshot.contextDebug.recent_messages} 条</p></details> : null}
    </section>
    <ChatInputBar
      attachments={runtimeSnapshot?.attachments || []}
      inputState={status === "error" ? "failed" : "idle"}
      onAddAttachment={source => runtime?.chooseAttachment(source)}
      onRemoveAttachment={index => runtime?.removeAttachment(index)}
      onPasteText={text => runtime?.addPastedText(text)}
      onSubmit={text => runtime?.sendMessage(text) || false}
      onVoiceCancel={() => runtime?.cancelVoice()}
      onVoiceStart={startVoice}
      onVoiceStop={() => runtime?.stopVoice()}
      sending={!runtime || sending}
      voiceState={voiceState}
      voiceTranscript={voiceTranscript}
    />
    <BottomNav activeId="conversation" items={navigation} onChange={onNavigate} state={keyboardVisible ? "disabled" : "default"} />
  </main>;
}
