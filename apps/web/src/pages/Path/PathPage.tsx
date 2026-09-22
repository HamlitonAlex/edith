import type { LegacyAppSnapshot } from "../../adapters";
import { PathNode } from "../../components";
import styles from "./PathPage.module.css";
export function PathPage({ snapshot, onNavigate }: { snapshot: LegacyAppSnapshot; onNavigate: (page: string) => void }) {
  const goal = snapshot.agent.long_term_goals[0]?.text;
  const skills = Object.values(snapshot.agent.skills).filter(item => item.label);
  const currentIndex = skills.findIndex(item => (item.confidence || 0) < .8);
  return <main className={styles.page} aria-label="学习路径"><header><button onClick={() => onNavigate("home")} type="button">‹</button><span><small>学习路径</small><h1>从真实的目标慢慢长出来</h1></span></header>{goal ? <section className={styles.goal}><small>当前确认的方向</small><h2>{goal}</h2><p>这是现在的方向，不是永远不能改变的身份标签。</p></section> : <section className={styles.empty}><b>方向会从对话里长出来。</b><p>在你确认之前，学程不会擅自给你贴目标或能力标签。</p></section>}<section className={styles.timeline}><div><h2>路径证据</h2><small>会随真实进展更新</small></div>{skills.map((skill, index) => <PathNode detail={skill.evidence?.at(-1)} key={skill.label || index} label={index < currentIndex || skill.confidence && skill.confidence >= .8 ? "已形成证据" : index === currentIndex ? "当前推进" : "等待更多经历"} pathState={index < currentIndex || skill.confidence && skill.confidence >= .8 ? "done" : index === currentIndex ? "current" : "upcoming"} title={skill.label || ""} />)}</section></main>;
}
