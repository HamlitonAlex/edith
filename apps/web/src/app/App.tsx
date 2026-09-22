import { useState } from "react";
import { BottomNav, GlassCard, ListRow } from "../components";
import styles from "./App.module.css";

const navigation = [
  { id: "home", label: "首页" },
  { id: "chat", label: "对话" },
  { id: "schedule", label: "日程" },
  { id: "profile", label: "我的" },
] as const;

/**
 * Phase 1 is a non-product component harness. It proves React, TypeScript,
 * CSS Modules, and the Pixso token layer without replacing a live page.
 */
export function App() {
  const [activeId, setActiveId] = useState<string>("home");

  return (
    <main className={styles.shell}>
      <GlassCard as="article" className={styles.card} state="default">
        <p className={styles.eyebrow}>学程 · UI Foundation</p>
        <h1>React 组件基础层已就绪</h1>
        <p>产品页面、API、认证与本地数据尚未迁移。</p>
      </GlassCard>
      <ListRow description="暂不绑定真实业务数据" leading="·" title="GlassCard / ListRow" trailing="›" />
      <BottomNav activeId={activeId} items={navigation} onChange={setActiveId} />
    </main>
  );
}
