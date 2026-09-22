import { useMemo, useState } from "react";
import type { LegacyAppSnapshot, LegacyMessage } from "../../adapters";
import { BottomNav, ChatBubble, ChatInputBar, GlassCard, NextStepCard } from "../../components";
import styles from "./ConversationPage.module.css";

const navigation = [{ id: "home", label: "首页", icon: "⌂" }, { id: "conversation", label: "对话", icon: "◌" }, { id: "schedule", label: "日程", icon: "□" }, { id: "profile", label: "我的", icon: "♙" }] as const;
export interface ConversationPageProps { snapshot: LegacyAppSnapshot; onNavigate: (page: string) => void; }

/** UI migration: messages originate in the same device-local document as legacy chat. */
export function ConversationPage({ onNavigate, snapshot }: ConversationPageProps) {
  const [drafts, setDrafts] = useState<LegacyMessage[]>([]);
  const messages = useMemo(() => [...snapshot.preferences.messages, ...drafts], [drafts, snapshot.preferences.messages]);
  return <main className={styles.page} aria-label="对话">
    <header className={styles.header}><button aria-label="返回首页" onClick={() => onNavigate("home")} type="button">‹</button><span><h1>和小程对话</h1><small>随时聊聊你的学习与成长</small></span><button aria-label="更多对话设置" type="button">•••</button></header>
    <section className={styles.messages} aria-live="polite">
      {!messages.length ? <div className={styles.empty}><img alt="" src="/assets/xuecheng-mark.svg" /><b>Hi，今天想从哪里开始？</b><p>想聊聊现在的状态，还是直接开始一件事？</p></div> : messages.map((message, index) => <ChatBubble key={message.clientMessageId || message.id || `${message.createdAt}-${index}`} message={message} />)}
      {snapshot.agent.next_recommended_action ? <NextStepCard action={snapshot.agent.next_recommended_action} onDiscuss={() => {}} onStart={() => {}} /> : null}
    </section>
    <ChatInputBar onSubmit={text => setDrafts(current => [...current, { role: "user", text, createdAt: new Date().toISOString() }])} />
    <BottomNav activeId="conversation" items={navigation} onChange={onNavigate} />
  </main>;
}
