import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { runtimeFromWindow, type LegacyRuntimePort, type RuntimeSnapshot, type RuntimeVoiceState } from "../adapters/legacy-runtime-adapter";

interface RuntimeContextValue {
  runtime: LegacyRuntimePort | null;
  snapshot: RuntimeSnapshot;
  voiceState: RuntimeVoiceState;
  voiceTranscript: string;
  keyboardVisible: boolean;
  notice: string;
}

const Context = createContext<RuntimeContextValue | null>(null);
const fallbackSnapshot = (): RuntimeSnapshot => ({
  preferences: { name: "小程", role: "guide", theme: "day", quietStart: "23:00", quietEnd: "07:30", messages: [], calendarEvents: [] },
  agent: { long_term_goals: [], skills: {}, next_recommended_action: null },
  sync: { title: "正在读取本地资料", detail: "所有数据仍由当前设备上的学程运行时管理。" },
  conversation: { status: "idle_empty", sending: false },
  remote: { status: "local", lastSyncedAt: null },
  auth: { status: "not_configured", configured: false, authenticated: false },
  attachments: [],
  calendarDate: new Date().toISOString().slice(0, 10),
  modelProviders: [],
  modelKeyConfigured: false,
});

export function LegacyRuntimeProvider({ children }: PropsWithChildren) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [runtime, setRuntime] = useState<LegacyRuntimePort | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(fallbackSnapshot);
  const [voiceState, setVoiceState] = useState<RuntimeVoiceState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [notice, setNotice] = useState("");
  const frameSource = import.meta.env.DEV ? "/iphone.html" : "/runtime/iphone.html";

  const refresh = useCallback(() => {
    const connected = frame.current?.contentWindow ? runtimeFromWindow(frame.current.contentWindow) : null;
    if (!connected) return;
    setRuntime(connected);
    try { setSnapshot(connected.getSnapshot()); } catch { /* the bridge can be between loads */ }
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "xuecheng:runtime-ready" || event.data.type === "xuecheng:runtime-snapshot") refresh();
      if (event.data.type === "xuecheng:runtime-toast" && typeof event.data.detail?.message === "string") {
        setNotice(event.data.detail.message);
        window.setTimeout(() => setNotice(current => current === event.data.detail.message ? "" : current), 2600);
      }
      if (event.data.type === "xuecheng:runtime-voice") {
        const detail = event.data.detail || {};
        setVoiceState(detail.state || "idle");
        if (typeof detail.transcript === "string") setVoiceTranscript(detail.transcript);
      }
    };
    const forwardNativeEvent = (type: "xuecheng:speech" | "xuecheng:native-keyboard") => (event: Event) => {
      const target = frame.current?.contentWindow;
      if (!target) return;
      target.dispatchEvent(new CustomEvent(type, { detail: (event as CustomEvent).detail }));
      if (type === "xuecheng:native-keyboard") setKeyboardVisible(Boolean((event as CustomEvent<{ visible?: boolean }>).detail?.visible));
    };
    const onSpeech = forwardNativeEvent("xuecheng:speech");
    const onNativeKeyboard = forwardNativeEvent("xuecheng:native-keyboard");
    const onViewportResize = () => {
      const viewport = window.visualViewport;
      const baseline = window.innerHeight;
      setKeyboardVisible(Boolean(viewport && baseline - viewport.height > 120));
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("xuecheng:speech", onSpeech);
    window.addEventListener("xuecheng:native-keyboard", onNativeKeyboard);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "xuecheng:iphone:v2" || event.key === "xuecheng:agent:v1") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("xuecheng:speech", onSpeech);
      window.removeEventListener("xuecheng:native-keyboard", onNativeKeyboard);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
    };
  }, [refresh]);

  const onLoad = useCallback(() => { refresh(); window.setTimeout(refresh, 0); }, [refresh]);
  const value = useMemo(() => ({ runtime, snapshot, voiceState, voiceTranscript, keyboardVisible, notice }), [runtime, snapshot, voiceState, voiceTranscript, keyboardVisible, notice]);
  return <Context.Provider value={value}>
    {children}
    {notice ? <output className="runtimeNotice" role="status">{notice}</output> : null}
    <iframe ref={frame} allow="microphone" aria-hidden="true" onLoad={onLoad} src={frameSource} tabIndex={-1} title="" />
  </Context.Provider>;
}

export function useLegacyRuntime() {
  const value = useContext(Context);
  if (!value) throw new Error("页面必须位于 LegacyRuntimeProvider 内");
  return value;
}
