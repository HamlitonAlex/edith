import type { NavigationItem, StatefulComponentProps } from "./types";
import styles from "./BottomNav.module.css";

export interface BottomNavProps extends StatefulComponentProps {
  activeId: string;
  items: readonly NavigationItem[];
  onChange?: (id: string) => void;
}

/** Navigation presentation only; route and data ownership remain with the app shell. */
export function BottomNav({
  activeId,
  className = "",
  items,
  onChange,
  state = "default",
}: BottomNavProps) {
  const disabled = state === "disabled" || state === "loading";

  return (
    <nav aria-label="主导航" className={`${styles.navigation} ${className}`.trim()} data-state={state}>
      {items.map(item => {
        const active = item.id === activeId;
        return (
          <button
            aria-current={active ? "page" : undefined}
            className={styles.item}
            disabled={disabled}
            key={item.id}
            onClick={() => onChange?.(item.id)}
            type="button"
          >
            {item.icon ? <span aria-hidden="true" className={styles.icon}>{item.icon}</span> : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
