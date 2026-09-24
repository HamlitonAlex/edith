# Edith AI Companion 架构设计

状态：Phase 8 设计稿（只读设计，不在本阶段修改业务代码）
基线：`7595653 docs: add iOS real-device acceptance checklist`

Edith 是学程中的长期成长伙伴。它不是一个“问一句答一句”的聊天机器人，也不是把全部聊天记录丢给模型的自动摘要器。它要在用户授权的边界内，逐渐理解用户、记录可验证的成长证据、提出一个当下可执行的下一步，并根据后续结果调整陪伴方式。

## 1. 产品定位与能力边界

### 1.1 核心闭环

```text
用户表达
  ↓
观察当前状态与意图
  ↓
读取少量相关长期背景、近期上下文和今天的现实约束
  ↓
给出一条有依据、可协商的下一步
  ↓
陪伴执行与验证掌握
  ↓
用户确认后记录成长日志 / 学习证据
  ↓
更新下一轮判断所需的用户模型
```

每一次判断都要回答：

- 现在发生了什么？
- 哪些是已经确认的长期事实，哪些只是本次信号？
- 这件事和哪个方向有关？
- 当前最大缺口是什么？
- 为什么现在推进，而不是另一个方向或休息？
- 用户可以如何拒绝、缩短、改期或换方式？

### 1.2 不做的事

- 不把一次“今天很累”升级成长期人格或目标判断。
- 不把完成一次任务等同于掌握知识。
- 不把模型的猜测写成用户事实。
- 不默认上传聊天、模型 Key、原始录音或私密日志。
- 不使用隐藏思维链作为产品输出；只保存可审计的证据摘要和判断摘要。
- 不用无限增长的聊天记录代替结构化记忆。

## 2. Memory System

Memory System 分为四个逻辑层。它们可以继续复用现有 `agentState`，不另建一套平行用户状态。

| 层 | 作用 | 时间尺度 | 写入条件 | 默认同步 |
| --- | --- | --- | --- | --- |
| `UserProfile` | 用户明确确认的稳定资料、关系偏好和长期方向 | 月 / 季度 | 用户确认或主动修改 | 仅同步允许字段 |
| `Memory` | 带来源和置信度的语义事实、偏好、约束 | 周 / 月 | 重复信号或用户确认 | 默认本地，逐条授权 |
| `DailyLog` | 某天的状态、安排、反思和计划变化 | 天 | 当天事件或用户确认的总结 | 默认本地，可选择同步 |
| `LearningEvidence` | 学习过程的验证结果、错因、迁移表现和 Tutor 摘要 | 周 / 长期 | 独立解释、迁移或用户确认 | 用户授权后同步文本摘要 |

### 2.1 UserProfile

稳定资料不是模型自行推断出来的标签。建议字段：

```text
UserProfile {
  id: string                 // 服务端验证身份映射的用户 ID
  companion: {
    name, role, gender,
    initiative, directness
  }
  confirmed_directions: [
    { id, label, statement, confidence, confirmed_at, status }
  ]
  preferences: {
    quiet_hours, theme, language
  }
  consent: {
    cloud_model, conversation_sync, learning_sync
  }
  updated_at: timestamp
  version: integer
}
```

`confirmed_directions` 只接受明确确认；单次新兴趣停留在信号层，不直接进入这里。

### 2.2 Memory

每条 Memory 都必须能回答“从哪里知道”和“多久没有被重新确认”。

```text
Memory {
  id: string
  subject: string            // goal / preference / constraint / pattern
  statement: string          // 去标识化、短句化事实
  value: unknown
  source_refs: [string]      // 事件、学习结果或用户确认记录的 ID
  evidence_count: integer
  confidence: 0..1
  stability: first_signal | repeated_signal | stable
  first_seen_at: timestamp
  last_confirmed_at: timestamp
  expires_at: timestamp|null
  status: proposed | confirmed | stale | rejected
  visibility: private | syncable
}
```

写入规则：

1. 一次出现：只形成 `proposed / first_signal`。
2. 不同日期或独立事件重复出现：提高 `evidence_count`，可变成 `repeated_signal`。
3. 用户确认或长期稳定重复：才进入 `confirmed / stable`。
4. 只在当天成立的内容不写入稳定 Memory；例如“今天很累”写入 `DailyLog.current_state`。
5. 长期未再确认的事实变为 `stale`，不会继续主导 Planner。

现有代码中的对应位置：

- `agentState.memory`：承载短语化、有来源的观察和学习结果摘要。
- `agentState.recent_events`：事件时间线，不直接等同于长期 Memory。
- `agentState.direction_signals`：兴趣稳定性信号，不直接等同于确认方向。
- `agentState.long_term_goals`：已确认方向。

### 2.3 DailyLog

```text
DailyLog {
  id: string
  user_id: string
  day: YYYY-MM-DD
  observations: [
    { id, text_summary, mood, energy, source, at }
  ]
  constraints: [
    { id, kind, text, starts_at, ends_at }
  ]
  proposed_next_step_id: string|null
  completed_actions: [string]
  reflection: {
    draft: string|null
    status: none | proposed | confirmed | rejected
    confirmed_at: timestamp|null
  }
  updated_at: timestamp
}
```

当天状态只影响当前判断的方式、时长和语气；它不能无确认地删除或改写长期方向。

### 2.4 LearningEvidence

```text
LearningEvidence {
  id: string
  user_id: string
  domain: python | c | mysql | english | general_knowledge | other
  topic: string
  action_id: string|null
  tutor_session_id: string|null
  assessed: {
    mastered: [string]
    partial: [string]
    unmastered: [string]
    common_errors: [
      concept | condition_omitted | order | syntax | read_not_write | transfer
    ]
  }
  evidence_type: explanation | independent_solution | transfer | correction
  confidence: 0..1
  created_at: timestamp
  visibility: private | syncable
}
```

仅记录结构化结果和短摘要，不保存 Tutor 的完整原始逐轮文本作为长期记忆。现有 `learning_results` 与 `tutor_metrics.history` 是第一阶段可复用来源。

## 3. AI Context Pipeline

### 3.1 每次对话的上下文层级

模型不接收完整本地资料，而是接收有预算的 Context Bundle：

```text
ContextBundle {
  system: {
    companion_role,
    safety_and_privacy_rules,
    output_contract,
    user_authority_rule
  }
  profile: {
    confirmed_directions,
    relevant_preferences,
    current_learning_domains
  }
  relevant_memory: [
    memories selected by topic, recency, stability and consent
  ]
  daily_context: {
    current_state,
    available_minutes,
    confirmed_schedule,
    pending_next_step
  }
  learning_context: {
    recent_evidence,
    repeated_errors,
    tutor_feedback
  }
  recent_conversation: [
    bounded recent text messages only
  ]
  current_user_message: string
}
```

优先顺序：当前用户消息 > 今日现实约束 > 相关学习证据 > 已确认方向 > 最近对话 > 较旧 Memory。冲突时保留冲突并降低置信度，不静默覆盖。

### 3.2 选择和预算规则

1. 先分类当前意图：倾听、讨论、行动、Tutor、资料边界或设置。
2. 根据当前主题、方向、学习领域和时间过滤 Memory。
3. 优先选择 `confirmed / stable`，再选择有两个以上独立来源的 `repeated_signal`。
4. 最近对话只取有限窗口；长历史通过摘要或分页检索，不全量拼接。
5. 没有足够依据时返回一个关键澄清问题，而不是补齐假设。
6. 云端模型只接收用户同意范围内的 Context Bundle；本地模型可使用设备上的同一结构化上下文。

### 3.3 Pipeline 步骤

```text
输入消息
  → observe：提取当前可验证信号
  → retrieve：按相关性、稳定性、时效和授权取上下文
  → assemble：生成有长度预算的 ContextBundle
  → generate：本地 Planner / 可选 BYOK 模型
  → validate：检查字段、证据引用、置信度和隐私边界
  → present：短答 / 一条 Next Step / 一个澄清问题
  → confirm：用户确认日志、方向、建议或学习结果
  → persist：写入对应层，并记录来源
```

## 4. AI 调用与输出契约

### 4.1 调用策略

- 本地规则 Planner 先做观察、诊断、建议和协商，保证无网络时仍可用。
- BYOK 云端模型只负责用户同意范围内的语言生成或解释，不可直接修改 UserProfile、Memory、DailyLog 或 LearningEvidence。
- 模型输出必须经过结构校验；解析失败时回到本地安全回复，不伪造成功。
- 模型 Key 只在当前会话使用，不能进入 Context Bundle 的持久副本、日志或同步载荷。

### 4.2 Next Step 输出

Next Step 必须保留现有判断链字段：

```text
NextStep {
  id: string
  observation: string
  current_context: object
  related_direction: object
  gap: object
  why_now: string
  next_action: string
  expected_gain: string
  duration_minutes: integer
  completion_criteria: string
  confidence: 0..1
  alternatives_considered: [
    { option, fit, reason_not_now }
  ]
  reconsider_if: string
  evidence_refs: [string]
  status: proposed | accepted | revised | deferred | rejected | completed
}
```

默认 UI 只显示 `next_action`、`why_now` 和时长；完整依据、替代方向和置信度放在可展开区域。置信度低于阈值时输出澄清问题，不硬生成任务。

### 4.3 成长日志流程

```text
用户输入 / 学习结果
  → AI 生成短摘要草稿
  → 用户查看、编辑、确认或拒绝
  → confirmed 才写入 Memory / DailyLog / LearningEvidence
  → 记录 source_refs 和 consent
```

建议的逻辑接口（本阶段只定义契约，不实现新 API）：

```text
createGrowthLogDraft(input, context) -> GrowthLogDraft
confirmGrowthLog(draftId, edits) -> ConfirmedGrowthLog
rejectGrowthLog(draftId, reason) -> RejectedGrowthLog
listRelevantGrowthLogs(query, limit, cursor) -> GrowthLogPage
```

状态：`draft → proposed → confirmed | rejected | expired`。
权限：草稿只在本地；确认后的记录仍按字段分别判断 `private` 或 `syncable`；服务端 user ID 只能由认证身份确定。

## 5. Home AI Next Step 设计

### 输入

- 已确认长期方向和当前阶段
- 最近稳定的 Memory 与方向信号
- 今天的 DailyLog、可用时间和现实安排
- 最近 LearningEvidence、Tutor 反馈和未完成原因
- 当前待处理的建议、拒绝或改期历史

### 判断

Planner 先比较候选方向，再选择一个最值得推进的缺口。它需要区分：

- 方向不清：先问问题，不安排任务。
- 状态短期受限：缩短、换形式或允许休息，不改长期方向。
- 同一缺口反复失败：检查任务大小、时机和前置知识，必要时回退诊断。
- 连续独立掌握：减少重复讲解，进入迁移或应用。
- 新兴趣只出现一次：记录信号，暂不抢占当前路径。

### 输出与反馈

Home 只展示一张真实 NextStepCard。用户可开始、讨论、缩短、推迟、拒绝或查看依据。每个动作都产生可追溯事件，下一次 Planner 读取结果但不把一次拒绝泛化为性格判断。

## 6. 隐私与数据边界

### 永不自动上传

- 模型 API Key、访问令牌和认证材料
- 原始录音、音频缓存和未确认的转写草稿
- 私密日志、临时输入和未确认的 Memory 草稿
- 设备标识、调试快照和隐藏模型上下文

### 经用户授权后可同步

- 已确认的伙伴资料和偏好
- 已确认的长期方向
- 用户明确允许同步的日程和文本对话
- 已确认的学习证据摘要
- Home 状态的最小投影

### 安全规则

- 所有本地数据按匿名或已验证账号隔离。
- 远端 API 从认证身份确定 user ID，不信任客户端传入的 user ID。
- 401、403、409、503 保持不同的 UI 状态；冲突不得静默覆盖。
- Memory 只保存短摘要和来源引用；原文仍留在其原始数据层并遵守各自保留策略。
- 用户可查看、编辑、拒绝和删除已确认的成长记录。

## 7. 与现有结构的衔接

Phase 8 不创建第二套状态系统。后续实现应先映射现有字段：

| Edith 概念 | 当前结构 | 后续动作 |
| --- | --- | --- |
| UserProfile | preferences + `long_term_goals` | 保持服务端 profile / agent scope，补确认元数据 |
| Memory | `agentState.memory` | 增加来源、稳定性和过期语义，保留 bounded history |
| DailyLog | `recent_events` + `current_state` + `today_context` | 以日期聚合读取，避免复制原始消息 |
| LearningEvidence | `learning_results` + `tutor_metrics.history` + skill evidence | 继续由 Tutor 验证结果驱动 |
| ContextBundle | `planner.buildContext` + `modelMessages` | 统一选择规则和云端脱敏投影 |
| NextStep | `next_recommended_action` | 保留 evidence / confidence / alternatives 字段 |

当前 `schema_version` 为 1。未来需要扩展时应提供显式迁移和回滚，不通过静默重建或清空本地数据升级。

## 8. 后续开发路线

### Phase 9：契约与迁移

- 为四层数据定义版本化 JSON Schema 和字段保留策略。
- 为现有 `agentState` 写只读投影和迁移测试。
- 增加来源、确认、稳定性、过期和隐私可见性字段。

### Phase 10：Context Assembler

- 在现有 Planner 上抽取统一 ContextBundle 选择器。
- 增加 token / 字符预算、主题相关性和隐私过滤测试。
- 让 BYOK 模型只收到脱敏后的显式 ContextBundle。

### Phase 11：成长日志与用户确认

- 先做本地草稿、确认、拒绝和编辑闭环。
- 将确认结果反馈到 UserProfile、Memory 或 LearningEvidence 的正确层。
- 增加“查看依据”和“撤回记录”入口，但不改变现有 UI 视觉方向。

### Phase 12：可选同步

- 在现有显式同步基础上增加成长日志最小投影。
- 逐条遵守用户授权、账号隔离、版本冲突和离线保留规则。
- 通过真实 OIDC、API 和 iOS 真机验收后，才考虑默认同步策略。

## 9. Phase 8 验收标准

- [ ] 长期信息、短期状态、事件和学习证据有明确边界。
- [ ] 一次偶然行为不能直接改变长期模型。
- [ ] Context 不再依赖全量聊天历史。
- [ ] Growth Log 必须经用户确认才进入长期层。
- [ ] Next Step 能引用证据并说明为什么不是其他方向。
- [ ] 私密数据、Key、原始录音不会进入普通同步载荷。
- [ ] 设计复用当前 `agentState`，没有第二套平行状态系统。
