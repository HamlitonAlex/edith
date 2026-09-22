import type { ReactNode } from "react";
import type { StatefulComponentProps } from "./types";
import styles from "./ListRow.module.css";

export interface ListRowProps extends StatefulComponentProps {
  description?: string;
  leading?: ReactNode;
  onClick?: () => void;
  title: string;
  trailing?: ReactNode;
}

/** Reusable Pixso list primitive with no knowledge of profile or schedule data. */
export function ListRow({
  className = "",
  description,
  leading,
  onClick,
  state = "default",
  title,
  trailing,
}: ListRowProps) {
  const interactive = Boolean(onClick) && state !== "disabled" && state !== "loading";
  const content = (
    <>
      {leading ? <span aria-hidden="true" className={styles.leading}>{leading}</span> : null}
      <span className={styles.copy}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </>
  );

  if (interactive) {
    return <button className={`${styles.row} ${className}`.trim()} data-state={state} onClick={onClick} type="button">{content}</button>;
  }

  return <div className={`${styles.row} ${className}`.trim()} data-state={state}>{content}</div>;
}
