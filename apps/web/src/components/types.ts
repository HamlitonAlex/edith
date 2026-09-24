import type { ElementType, ReactNode } from "react";

export type ComponentState = "default" | "active" | "disabled" | "loading" | "error";

export interface StatefulComponentProps {
  state?: ComponentState;
  className?: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export type PolymorphicElement = Extract<ElementType, "article" | "section" | "div">;
