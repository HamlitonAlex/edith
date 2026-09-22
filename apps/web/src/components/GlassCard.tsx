import type { PropsWithChildren } from "react";
import type { PolymorphicElement, StatefulComponentProps } from "./types";
import styles from "./GlassCard.module.css";

export interface GlassCardProps extends PropsWithChildren, StatefulComponentProps {
  as?: PolymorphicElement;
}

/** Visual-only Pixso surface. Product data stays outside this component. */
export function GlassCard({
  as: Component = "section",
  children,
  className = "",
  state = "default",
}: GlassCardProps) {
  return (
    <Component
      aria-busy={state === "loading" || undefined}
      className={`${styles.card} ${className}`.trim()}
      data-state={state}
    >
      {children}
    </Component>
  );
}
