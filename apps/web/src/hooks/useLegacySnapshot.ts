import { useEffect, useState } from "react";
import { readLegacyAppSnapshot } from "../adapters/legacy-app-store";

const subscribe = (notify: () => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key === "xuecheng:iphone:v2" || event.key === "xuecheng:agent:v1") notify();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};

/** Same device-local state document used by the existing product screens. */
export function useLegacySnapshot() {
  const [snapshot, setSnapshot] = useState(readLegacyAppSnapshot);
  useEffect(() => subscribe(() => setSnapshot(readLegacyAppSnapshot())), []);
  return snapshot;
}
