import type { StatefulComponentProps } from "./types";
import styles from "./Switch.module.css";
export interface SwitchProps extends StatefulComponentProps { checked: boolean; label: string; onChange?: (value: boolean) => void; }
export function Switch({ checked, label, onChange, state = "default" }: SwitchProps) { return <button aria-checked={checked} aria-label={label} className={styles.switch} data-state={state} disabled={state === "disabled" || state === "loading"} onClick={() => onChange?.(!checked)} role="switch" type="button"><i /></button>; }
