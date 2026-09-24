import { useState } from "react";
import type { OnboardingIntent } from "../../adapters/legacy-onboarding-store";
import styles from "./Onboarding.module.css";

const options: Array<{ id: OnboardingIntent; title: string; detail: string }> = [
  { id: "exam", title: "准备考试或升学", detail: "把复习和节奏安排得更清楚" },
  { id: "skill", title: "学习一项新技能", detail: "从想学，慢慢走到会用" },
  { id: "course", title: "完成课程与作业", detail: "把眼前的事梳理成下一步" },
  { id: "growth", title: "自我提升与阅读", detail: "为长期想成为的人留出空间" },
];

export interface OnboardingProps {
  initialIntent?: OnboardingIntent;
  onComplete: (intent: OnboardingIntent) => void;
}

/** Pixso Frame3419, mapped onto the existing local preference document. */
export function Onboarding({ initialIntent = "skill", onComplete }: OnboardingProps) {
  const [intent, setIntent] = useState<OnboardingIntent>(initialIntent);
  return (
    <main className={styles.page} aria-labelledby="onboarding-title">
      <header className={styles.topbar}>
        <span className={styles.wordmark}><img src="/assets/xuecheng-mark.svg" alt="" />学程</span>
        <span className={styles.step}>1 / 1</span>
      </header>
      <section className={styles.content}>
        <div className={styles.progress} aria-label="首次引导进度"><i /></div>
        <p className={styles.eyebrow}>先从现在的你开始</p>
        <h1 id="onboarding-title">你想先把哪件事慢慢做好？</h1>
        <p className={styles.description}>选一个最接近的方向。之后每一步都可以在设置中调整。</p>
        <div className={styles.options} role="radiogroup" aria-label="当前目标">
          {options.map((option) => {
            const selected = intent === option.id;
            return <button aria-checked={selected} className={styles.option} key={option.id} onClick={() => setIntent(option.id)} role="radio" type="button">
              <span className={styles.radio} aria-hidden="true" />
              <span><b>{option.title}</b><small>{option.detail}</small></span>
            </button>;
          })}
        </div>
        <p className={styles.note}>这些信息只用于给出建议，你可以随时修改或删除。</p>
      </section>
      <footer className={styles.actions}>
        <button className={styles.continue} onClick={() => onComplete(intent)} type="button">继续</button>
        <button className={styles.skip} onClick={() => onComplete(intent)} type="button">暂时跳过</button>
      </footer>
    </main>
  );
}
