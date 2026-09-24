import { useEffect, useState, type ReactNode } from "react";
import type { LegacyAppSnapshot, LegacyRuntimePort, RuntimeSnapshot } from "../../adapters";
import { BottomNav, ListRow, Switch } from "../../components";
import styles from "./ProfilePage.module.css";

const navigation = [{ id: "home", label: "首页", icon: "⌂" }, { id: "conversation", label: "对话", icon: "◌" }, { id: "schedule", label: "日程", icon: "□" }, { id: "profile", label: "我的", icon: "♙" }] as const;
const roles = [{ id: "guide", label: "引路人" }, { id: "friend", label: "朋友" }, { id: "family", label: "家人" }, { id: "partner", label: "伴侣式伙伴" }] as const;
const genders = [{ id: "female", label: "她" }, { id: "male", label: "他" }, { id: "neutral", label: "TA" }] as const;

function Group({ children, title }: { children: ReactNode; title: string }) { return <section className={styles.group}><h2>{title}</h2><div>{children}</div></section>; }
function isRuntime(snapshot: RuntimeSnapshot | LegacyAppSnapshot): snapshot is RuntimeSnapshot { return "auth" in snapshot; }

export function ProfilePage({ snapshot, onNavigate, runtime }: { snapshot: RuntimeSnapshot | LegacyAppSnapshot; runtime: LegacyRuntimePort | null; onNavigate: (page: string) => void }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState(snapshot.preferences.name);
  const [quietStart, setQuietStart] = useState(snapshot.preferences.quietStart);
  const [quietEnd, setQuietEnd] = useState(snapshot.preferences.quietEnd);
  const [initiative, setInitiative] = useState(snapshot.preferences.initiative ?? 0.65);
  const [directness, setDirectness] = useState(snapshot.preferences.directness ?? 0.55);
  const [providerId, setProviderId] = useState(snapshot.preferences.modelConfig?.providerId || "openai");
  const [endpoint, setEndpoint] = useState(snapshot.preferences.modelConfig?.endpoint || "");
  const [model, setModel] = useState(snapshot.preferences.modelConfig?.model || "");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState("");
  const configured = isRuntime(snapshot) ? snapshot.auth.configured : false;
  const authenticated = isRuntime(snapshot) ? snapshot.auth.authenticated : false;
  const modelProviders = isRuntime(snapshot) ? snapshot.modelProviders : [];
  const sync = isRuntime(snapshot) ? snapshot.sync : { title: "仅在这台设备", detail: "不会在后台上传你的数据。" };
  const keyConfigured = isRuntime(snapshot) && snapshot.modelKeyConfigured;

  useEffect(() => {
    setName(snapshot.preferences.name);
    setQuietStart(snapshot.preferences.quietStart);
    setQuietEnd(snapshot.preferences.quietEnd);
    setInitiative(snapshot.preferences.initiative ?? 0.65);
    setDirectness(snapshot.preferences.directness ?? 0.55);
    if (snapshot.preferences.modelConfig) {
      setProviderId(snapshot.preferences.modelConfig.providerId || "openai");
      setEndpoint(snapshot.preferences.modelConfig.endpoint || "");
      setModel(snapshot.preferences.modelConfig.model || "");
    }
  }, [snapshot.preferences.name, snapshot.preferences.quietStart, snapshot.preferences.quietEnd, snapshot.preferences.initiative, snapshot.preferences.directness, snapshot.preferences.modelConfig]);

  const providerChanged = (value: string) => {
    setProviderId(value);
    setEndpoint(modelProviders.find(provider => provider.id === value)?.endpoint || "");
    setModels([]);
    setModel("");
    setApiKey("");
    setModelError("");
  };
  const loadModels = async () => {
    if (!runtime) return;
    setModelBusy(true);
    setModelError("");
    try {
      const result = await runtime.listModels({ providerId, endpoint, apiKey });
      setModels(result);
      if (result.length && !result.includes(model)) setModel(result[0]);
      if (!result.length) setModelError("连接成功，但服务没有返回可用模型。");
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "连接失败，请检查地址和密钥。");
    } finally { setModelBusy(false); }
  };

  if (settingsOpen) return <main className={styles.page} aria-label="系统设置">
    <header className={styles.settingsHeader}><button aria-label="返回我的" onClick={() => setSettingsOpen(false)} type="button">‹</button><span><small>学程</small><h1>设置</h1></span></header>
    <Group title="界面氛围"><ListRow description={snapshot.preferences.theme === "night" ? "夜间" : "日间"} leading="◐" title="切换为夜间界面" trailing={<Switch checked={snapshot.preferences.theme === "night"} label="切换夜间界面" onChange={value => runtime?.setTheme(value ? "night" : "day")} />} /></Group>
    <Group title="模型与智能">
      <label className={styles.settingField}><span>允许当前对话使用云端模型</span><Switch checked={Boolean(snapshot.preferences.cloudConsent)} label="允许云端模型" onChange={value => runtime?.setCloudConsent(value)} /></label>
      <label className={styles.settingField}><span>模型服务</span><select onChange={event => providerChanged(event.target.value)} value={providerId}>{modelProviders.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label className={styles.settingField}><span>API 地址</span><input autoComplete="url" onChange={event => setEndpoint(event.target.value)} type="url" value={endpoint} /></label>
      <label className={styles.settingField}><span>API Key（只在本次会话保留）</span><input autoComplete="off" onChange={event => setApiKey(event.target.value)} placeholder={keyConfigured ? "Key 已保存在当前应用会话中" : "粘贴 API Key"} type="password" value={apiKey} /></label>
      <div className={styles.modelActions}><button disabled={modelBusy} onClick={() => void loadModels()} type="button">{modelBusy ? "正在连接…" : "测试连接"}</button><button disabled={modelBusy} onClick={() => void loadModels()} type="button">获取模型</button></div>
      {modelError ? <p className={styles.error} role="alert">{modelError}</p> : null}
      <label className={styles.settingField}><span>默认模型</span><select onChange={event => setModel(event.target.value)} value={model}>{model ? <option value={model}>{model}</option> : <option value="">先获取模型</option>}{models.filter(value => value !== model).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button className={styles.primaryAction} disabled={!model || !snapshot.preferences.cloudConsent} onClick={() => { if (runtime?.saveModel({ providerId, endpoint, apiKey, model })) setApiKey(""); }} type="button">保存并设为默认</button>
      <p className={styles.note}>密钥不会写入长期资料、对话或备份。</p>
    </Group>
    <Group title="资料与授权">
      <ListRow description="你的安排先保存在设备上" leading="▦" onClick={() => runtime?.importCalendar()} title="导入 .ics 日历" trailing="›" />
      <ListRow description="只删除允许长期引用的资料，不删除对话" leading="⌫" onClick={() => runtime?.clearSources()} title="清除已授权资料" trailing="›" />
      <ListRow description="加密后导出到你选择的位置" leading="⇧" onClick={() => runtime?.exportBackup()} title="导出本地备份" trailing="›" />
      <ListRow description="恢复前会再次确认覆盖范围" leading="⇩" onClick={() => runtime?.importBackup()} title="从备份恢复" trailing="›" />
    </Group>
    <Group title="同步"><ListRow description={sync.detail} leading="⇅" onClick={() => configured && !authenticated ? runtime?.beginLogin() : runtime?.syncNow()} title={sync.title} trailing={configured && !authenticated ? "登录" : "立即同步"} /></Group>
    <BottomNav activeId="profile" items={navigation} onChange={onNavigate} />
  </main>;

  return <main className={styles.page} aria-label="我的">
    <header className={styles.profileHeader}>
      <button aria-label="更换伙伴图片" className={styles.avatar} onClick={() => runtime?.chooseAvatar()} type="button"><img alt="" src={snapshot.preferences.avatar || "/assets/xuecheng-mark.svg"} /><span>更换</span></button>
      <span><small>你的长期伙伴</small><input aria-label="伙伴名字" maxLength={12} onBlur={() => runtime?.setProfile({ name })} onChange={event => setName(event.target.value)} value={name} /><p>{roles.find(role => role.id === snapshot.preferences.role)?.label || "引路人"}会按你的反馈调整相处方式。</p></span>
      {snapshot.preferences.avatar && snapshot.preferences.avatar !== "/assets/xuecheng-mark.svg" ? <button className={styles.resetAvatar} onClick={() => runtime?.resetAvatar()} type="button">恢复默认图标</button> : null}
    </header>
    <Group title="她现在知道的我"><ListRow description="从一起经历的事里慢慢形成" leading="⌁" onClick={() => onNavigate("path")} title="长期方向与学习证据" trailing="›" /></Group>
    <Group title="相处方式">
      <div className={styles.choiceSection}><small>伙伴角色</small><div className={styles.choices}>{roles.map(role => <button aria-pressed={snapshot.preferences.role === role.id} className={snapshot.preferences.role === role.id ? styles.selected : ""} key={role.id} onClick={() => runtime?.setProfile({ role: role.id })} type="button">{role.label}</button>)}</div></div>
      <div className={styles.choiceSection}><small>伙伴称呼</small><div className={styles.choices}>{genders.map(gender => <button aria-pressed={(snapshot.preferences.gender || "female") === gender.id} className={(snapshot.preferences.gender || "female") === gender.id ? styles.selected : ""} key={gender.id} onClick={() => runtime?.setProfile({ gender: gender.id })} type="button">{gender.label}</button>)}</div></div>
      <label className={styles.rangeField}><span>主动找你的程度 <b>{Math.round(initiative * 100)}%</b></span><input max="1" min="0" onBlur={() => runtime?.setProfile({ initiative })} onChange={event => setInitiative(Number(event.target.value))} onPointerUp={() => runtime?.setProfile({ initiative })} step=".05" type="range" value={initiative} /></label>
      <label className={styles.rangeField}><span>提出不同意见的直接程度 <b>{Math.round(directness * 100)}%</b></span><input max="1" min="0" onBlur={() => runtime?.setProfile({ directness })} onChange={event => setDirectness(Number(event.target.value))} onPointerUp={() => runtime?.setProfile({ directness })} step=".05" type="range" value={directness} /></label>
    </Group>
    <Group title="通知与安静时段">
      <label className={styles.settingField}><span>安静开始</span><input onBlur={() => runtime?.setQuietHours(quietStart, quietEnd)} onChange={event => setQuietStart(event.target.value)} type="time" value={quietStart} /></label>
      <label className={styles.settingField}><span>安静结束</span><input onBlur={() => runtime?.setQuietHours(quietStart, quietEnd)} onChange={event => setQuietEnd(event.target.value)} type="time" value={quietEnd} /></label>
      <ListRow description="紧迫的事情仍会说明原因" leading="!" title="重要事情可以覆盖安静时段" trailing={<Switch checked={snapshot.preferences.urgentOverride !== false} label="允许紧急事项覆盖安静时段" onChange={value => runtime?.setUrgentOverride(value)} />} />
    </Group>
    <Group title="跨设备同步"><ListRow description={sync.detail} leading="⇅" onClick={() => configured && !authenticated ? runtime?.beginLogin() : runtime?.syncNow()} title={sync.title} trailing={configured && !authenticated ? "登录" : "立即同步"} /></Group>
    <Group title="更多"><ListRow description="模型、本地数据与授权" leading="⚙" onClick={() => setSettingsOpen(true)} title="系统设置" trailing="›" /></Group>
    <BottomNav activeId="profile" items={navigation} onChange={onNavigate} />
  </main>;
}
