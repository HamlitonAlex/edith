import { useState, type ReactNode } from "react";
import type { LegacyAppSnapshot } from "../../adapters";
import { BottomNav, ListRow, Switch } from "../../components";
import styles from "./ProfilePage.module.css";
const navigation = [{ id: "home", label: "首页", icon: "⌂" }, { id: "conversation", label: "对话", icon: "◌" }, { id: "schedule", label: "日程", icon: "□" }, { id: "profile", label: "我的", icon: "♙" }] as const;

function Group({ children, title }: { children: ReactNode; title: string }) { return <section className={styles.group}><h2>{title}</h2><div>{children}</div></section>; }
export function ProfilePage({ snapshot, onNavigate }: { snapshot: LegacyAppSnapshot; onNavigate: (page: string) => void }) {
  const [theme, setTheme] = useState(snapshot.preferences.theme === "night");
  const [quiet, setQuiet] = useState(true);
  return <main className={styles.page} aria-label="我的"><header><img alt="" src="/assets/xuecheng-mark.svg" /><span><small>你的长期伙伴</small><h1>{snapshot.preferences.name}</h1><p>她会像一位了解你的朋友，也会在需要时挑战你。</p></span></header><Group title="她现在知道的我"><ListRow description="从一起经历的事里慢慢形成" leading="⌁" title="长期方向与学习证据" trailing="›" /></Group><Group title="相处方式"><ListRow description={snapshot.preferences.role === "guide" ? "引路人" : snapshot.preferences.role} leading="◌" title="伙伴角色" trailing="›" /><ListRow description={theme ? "夜间" : "日间"} leading="◐" title="界面氛围" trailing={<Switch checked={theme} label="切换夜间界面" onChange={setTheme} />} /></Group><Group title="通知与安静时段"><ListRow description={`${snapshot.preferences.quietStart} 至 ${snapshot.preferences.quietEnd}`} leading="◷" title="安静时段" trailing={<Switch checked={quiet} label="启用安静时段" onChange={setQuiet} />} /></Group><Group title="跨设备同步"><ListRow description="由你决定什么时候同步" leading="⇅" onClick={() => {}} title="仅在这台设备" trailing="›" /></Group><BottomNav activeId="profile" items={navigation} onChange={onNavigate} /></main>;
}
