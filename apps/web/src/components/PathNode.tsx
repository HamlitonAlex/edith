import type { StatefulComponentProps } from "./types";
import styles from "./PathNode.module.css";

export type PathState = "done" | "current" | "upcoming";
export interface PathNodeProps extends StatefulComponentProps { detail?: string; label: string; pathState: PathState; title: string; }

export function PathNode({ detail, label, pathState, state = "default", title }: PathNodeProps) {
  return <article className={styles.node} data-component-state={state} data-path-state={pathState}><i aria-hidden="true" /><div><small>{label}</small><strong>{title}</strong>{detail ? <p>{detail}</p> : null}</div></article>;
}
