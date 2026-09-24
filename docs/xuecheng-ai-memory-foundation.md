# 学程 AI Memory Foundation

本文件记录学程在 AI 能力层的第一段可运行基础：把用户确认过的长期信息、当天成长日志和可验证的学习证据，以本地优先、可确认、可归档的方式保存和取用。它不是自动决策系统，也不把完整聊天记录当作记忆库。

## 1. 产品边界

小程是长期成长伙伴：理解用户、记录有价值的成长信号、解释下一步建议的依据，并根据已确认的事实调整陪伴方式。

本阶段只提供结构化 Memory Foundation，不提供：

- 向量数据库、RAG 或整库聊天检索；
- 多智能体协作、自动发提醒或后台主动推送；
- 自动把模型推断、普通对话或一次任务完成写成长期事实；
- 自动上传既有本地聊天、模型密钥、原始录音或私密日志。

## 2. 数据模型与确认流

### 用户资料

沿用现有用户资料与 `home_snapshots`，不建立第二份个人档案。`UserProfile` 只承载用户明确确认的稳定方向、偏好和陪伴设置；当前情绪、一次聊天中的猜测和某天的安排不写进这里。

Context Builder 只读取可用于陪伴的最小投影：昵称、陪伴风格、当前阶段、明确保存的长期目标和兴趣。结构化方向项必须是 `status: confirmed` 且 `confirmed_by_user: true`；为兼容既有本地状态，调用方传入的纯文本方向已被视为完成确认后的投影。它不会读取模型 Key、头像原始数据、设备配置或未经确认的方向信号。

### 结构化记忆 `memories`

字段包括：`id`、`user_id`、`type`、`content`、`topic`、`source_type`、`source_id`、置信度、重要度、状态、创建和更新时间。`source_id` 是短的、不透明记录标识，不能承载聊天正文。

可用类型：

- `long_term`：经用户确认的长期目标、偏好或稳定方向；
- `stage`：当前阶段或一段时期的工作重点；
- `recent_event`：近期完成、变化或现实约束。

状态流：

```text
proposed → confirmed → archived
             ↓
           deleted（从存储与 Context 移除）
```

模型或对话只能先生成 `proposed`。只有用户通过确认操作，才会进入 `confirmed`；`archived`、带删除标记的记录和真正删除的记录都会立即退出 AI Context。创建时不能绕过确认直接写入 `confirmed`，确认后的记录必须显式标记 `confirmed_by_user: true`。

来源可追溯，但不复制来源内容。读取来源时只返回类型、短标识、可读标签和创建时间；例如“来源：9 月 24 日与小程的对话”，而不是一段完整聊天、录音转写或附件内容。

### 每日成长日志 `daily_logs`

每日仅一份，字段包括：完成内容、困难、学到什么、明日计划、AI 摘要和状态。

状态为 `draft`、`proposed`、`confirmed`：

```text
用户自然表达 / 本地编辑 → draft 或 proposed → 用户确认 → confirmed
```

AI 摘要在草稿或提议状态下不会进入 Context，连同完成内容、困难和明日计划都不能作为正式成长记录。只有 `status: confirmed` 且 `confirmed_by_user: true` 的日志才会以当天总结进入 Context。已确认日志不可被普通更新接口静默改写。

### 学习证据 `learning_evidence`

学习证据必须来自可以追溯的结果：练习完成、正确或错误答案、辅导观察、自评、项目完成或考试结果。兼容当前项目结构的证据类型包括 `exercise_completed`、`practice_completed`、`correct_answer`、`wrong_answer`、`incorrect_answer`、`tutor_verification`、`tutor_observation`、`self_assessment`、`user_self_report`、`assessment`、`project_completed`、`exam_result`，以及架构文档中的 `explanation`、`independent_solution`、`transfer`、`correction`；每条含主题、技能、证据类型、结果、可选分数、来源、置信度和时间。

普通聊天、单次提问、只点击了“完成”都不会自动变成掌握证据。用户来源只能写入 `self_assessment` 或 `user_self_report`；同一来源、主题、技能、证据类型只能写入一次，避免重试造成重复证据。`LearningEvidence` 与 `Memory` 是两个不同集合，且没有 `mastered` 写入字段：后续掌握判断必须综合主题、结果、来源、时间和多条证据，不能由一次事件或小程的主观判断生成。

## 3. 服务端持久化与访问控制

迁移文件：`apps/api/db/migrations/003_ai_memory_foundation.sql`。

三张表均以 `(user_id, id)` 为主键，并带有外键、索引、创建/更新时间和必要唯一约束。所有查询和写入都由已验证的服务端身份确定 `user_id`，客户端不能提交或覆盖该值。

相关 API：

| 资源 | 读取 | 写入与状态操作 |
| --- | --- | --- |
| 记忆 | `GET /api/v1/memories`、`GET /api/v1/memories/:id`、`GET /api/v1/memories/:id/source` | `POST /api/v1/memories`（仅创建提议）、`POST /:id/confirm`、`POST /:id/archive`、`DELETE /:id` |
| 成长日志 | `GET /api/v1/daily-logs`、`GET /api/v1/daily-logs/:id` | `POST /api/v1/daily-logs`（草稿或提议）、`PATCH /:id`、`POST /:id/confirm`、`DELETE /:id` |
| 学习证据 | `GET /api/v1/learning-evidence`、`GET /api/v1/learning-evidence/:id` | `POST /api/v1/learning-evidence`、`DELETE /:id` |
| Context 预览 | — | `POST /api/v1/context/preview` |

前端沿用 `React → Hook → Adapter → Repository → API / Local Store`；组件不直接请求 Memory API。`propose` 是创建 `proposed` 记录，`confirm`、`archive`、`delete` 和 `inspect source` 分别是明确的状态或读取动作，不以通用 CRUD 名义掩盖用户决策。

私人接口延续现有 OIDC RS256 身份验证。服务端从已验证身份确定 `user_id`，不信任客户端提交的身份字段；无凭据为 `401`，客户端试图传入身份覆盖字段为 `403`，版本冲突使用 `409` 或 `428`，格式错误为 `422`。响应继续使用 `data/meta` 与版本信息；更新、确认、归档和删除使用 ETag / `If-Match`，冲突不得静默覆盖。

## 4. Context Builder

`apps/web/agent/context-builder.js` 构造可审计、有限大小的模型 Context Bundle。它是只读函数：不写入数据、不修改传入的本地状态，也不从完整聊天或整个资料库拼装提示词。

### 输入与输出契约

输入以当前用户为作用域，至少接受：当前用户与已确认资料、当前会话和最新输入、当前任务、当天状态、当天日志、记忆、学习证据和显式字符预算。已登录调用应在 `current_user.id` 或 `current_user.user_id` 中传入当前身份；服务端还必须先按已验证身份查询数据。

输出是版本化的结构化对象，不是可直接拼接的历史聊天：

```text
ContextBundle {
  schema_version, budget_chars, system_instructions,
  current_user: confirmed profile projection,
  current_input, current_task, current_date, today_state,
  recent_conversation,
  relevant_memory,
  relevant_learning_evidence,
  proposed_memories,
  truncation
}
```

`relevant_memory` 只含已确认且未归档/未删除的短句化记录。`proposed_memories` 是单独的待确认项目；它可帮助小程在相邻对话显示确认卡，但系统指令要求它不能作为用户事实、偏好、能力或任务前提。学习证据始终保留在 `relevant_learning_evidence`，不会被转写成“已掌握”。

### 过滤、来源与隔离

- 记忆必须同时满足 `status === confirmed` 与 `confirmed_by_user === true`；`proposed`、`archived`、`deleted_at`、`deleted` 或其他用户的显式归属记录都会被丢弃。
- 每日日志必须同时满足 `status === confirmed` 与 `confirmed_by_user === true`；草稿和提议不会泄露其摘要、完成内容或明日计划。
- 带有与当前用户不同 `user_id` / `userId` 的消息、任务、记忆、日志和证据不会进入 Bundle。未登录本地数据可以在匿名本地作用域使用；登录后的服务端数据必须由认证身份的作用域提供。
- 每个记忆或证据最多带一个 `{ type, id }` 的来源短引用。`source_excerpt`、`source_metadata`、原始聊天、原始录音、附件和调试字段不会被复制到 Bundle。
- 最近会话最多保留 12 条，每条最多 640 个字符；稳定记忆最多 480 个字符，学习证据结果最多 560 个字符。当前用户正在发送的输入另作当前回合处理，不被当作历史来源复制。

### 结构化检索与稳定预算

本阶段不用向量数据库。候选项仅按 `type`、`status`、`topic`、`created_at`、`importance` / `confidence`、来源和用户作用域筛选。相关性由主题命中、重要度（证据使用置信度）和时效组成；相同分数依次按时间和稳定短标识排序。调用方提供相同数据、日期和预算时，得到相同的项目顺序与 `truncation` 结果。

默认预算是 12,000 字符，允许范围是 1,200–30,000。低预算时固定按以下顺序尝试保留：

1. 当前用户输入；
2. 当前任务，以及影响当次可行性的当天即时约束；
3. 必要的最近会话；
4. 高相关、已确认的稳定记忆；
5. 高相关学习证据；
6. 已确认的稳定资料；
7. 已确认的当天日志和 `recent_event` 记忆；
8. 待确认记忆提议。

低优先内容先被省略；不会为了保留一整份资料而挤掉当前输入。`truncation` 按记忆、证据、消息、提议、资料、当天状态、任务和字符记录被省略数量，使调用方可以审计本轮不是“没有数据”，而是“未进入预算”。

## 5. 本地优先与显式同步

浏览器侧 `createMemoryRepository` 使用账号作用域的本地存储；登录身份应以已验证的发行方和用户标识生成无歧义作用域。未登录或网络不可用时仍可创建、确认、归档和阅读自己的本地记录。游客数据保留在当前本地会话作用域，退出并切换会话时轮换作用域；切换账号会取消进行中的同步并切换独立存储，不会混用上一位用户的数据。

同步必须由用户在“我的”中显式触发；登录不会自动上传历史本地内容。同步过程：

```text
本地结构化记录
  → 用户主动同步
  → 按稳定 ID 创建或安全重试
  → Memory / Daily Log 在远端先建立提议，再执行确认迁移
  → 更新远端版本
```

只有 `status: confirmed` 且 `confirmed_by_user: true` 的 Memory 与 Daily Log 才有资格进入本轮同步。`proposed` Memory、`draft` / `proposed` Daily Log 继续只留在设备上，不会因同步按钮被上传。Learning Evidence 仅以已清洗的结构化摘要参与显式同步，不能携带聊天、附件或 Tutor 原文。

同一 ID 的重试是幂等的；远端存在同一 ID 但不同内容或不兼容状态时，返回冲突，不覆盖任一端数据。ETag / `If-Match` 和版本号用于检测竞争更新。网络失败只记录同步失败状态，不删除或回滚本地记录。

允许同步：

- 用户确认且处于授权同步范围的资料投影；
- 用户确认后的结构化 Memory 与 Daily Log；
- 用户主动同步的结构化 Learning Evidence 摘要；
- 已确认的日程和首页状态（沿用各自既有边界）。

永不经此模块自动上传：

- 模型 API Key、访问令牌或其他凭据；
- 原始录音及音频二进制；
- 未经用户确认批量迁移的历史本地数据；
- 原始聊天全文、私密附件、设备临时缓存和调试日志；
- 未确认 Memory、Daily Log 草稿或提议，以及来源原文。

## 6. UX integration contract

这一阶段只提供数据和状态契约，不新增完整记忆管理页或改变 Conversation / Home 视觉。后续界面必须遵循 `docs/xuecheng-ux-system.md`：简单确认在原对话或原卡片完成，确认后原位置变成结果；Profile 才承载查看、编辑、归档、删除和来源追踪。

内部状态不能直接暴露为工程术语。前端使用以下映射：

| 内部状态或结果 | 用户看到的自然表达 | 位置与操作 |
| --- | --- | --- |
| `Memory.status: proposed` | “这个目标会帮助我以后安排学习。要让我记住吗？” | 对话内卡片：`[记住] [暂时不用]` |
| `Memory.status: confirmed` + `confirmed_by_user` | “✓ 我记住了” | 同一卡片原位置更新，不跳转管理页 |
| `Memory.status: archived` | “这条内容不会再用于后续安排。” | Profile 的管理项；可按后续权限设计恢复 |
| 删除 Memory | “已删除这条记忆。” | 删除是例外的高影响操作，可先明确确认 |
| Daily Log `draft` / `proposed` | “我把今天整理成几条记录，要保存吗？” | 当前对话：`[保存今日记录] [修改]` |
| Daily Log `confirmed` | “✓ 今日记录已保存” | 原卡片更新；不是“日志创建成功” |
| 单条 Learning Evidence | “这次练习说明你已经做到这里；目前还不能只凭一次确定完全掌握。” | 只解释证据和下一步，不展示 `confidence`、`mastered` 或内部枚举 |
| 来源短引用 | “来源：9 月 24 日与小程的对话” | Profile 的“查看来源”；只显示标签和时间，不展开完整私人内容 |
| 同步成功 | “✓ 已同步于 14:30” | “我的”中显示最近结果 |
| 同步失败 | “刚才没有同步成功，你的本地内容还在。” | 轻量提示加可重试操作，不丢本地数据 |
| 版本冲突 | “发现两处内容不一致，先选择要保留的版本。” | 要求用户决定，绝不静默覆盖 |

小程可以提出、解释和提醒确认，但不能把 `proposed` 说成既成事实，也不能把一次聊天或一次练习说成“已经掌握”。“暂时不用”是有效选择；确认、保存和同步成功后不再重复发起同一确认。

## 7. 可验证性

Context Builder 的测试覆盖确认门槛、归档/删除排除、来源短引用、跨用户过滤、Daily Log 确认门槛、Evidence 与 Memory 分离、预算内稳定裁剪以及本地状态不变性。Repository / API 测试另外覆盖本地离线持久化、同步重试幂等性、冲突不覆盖和同步投影的敏感字段排除。

新增调用点至少应验证：相同输入、相同日期、相同预算得到相同 Context；Context 不含其他用户的显式归属数据；未确认内容不影响长期判断；以及 JSON 输出不超过请求的字符预算。

## 8. 之后的开发顺序

本阶段完成后，后续工作应保持逐步、可验证：

1. 在真实的小程对话/辅导完成事件中创建“待确认”记忆或成长日志草稿；
2. 让用户在界面中查看、修改、确认、归档这些结构化项目；
3. 在 AI 调用入口接入 Context Builder 的最小投影；
4. 在真实 iPhone 上验证语音转写只回填文本、不会上传原始录音；
5. 用户明确授权后，再单独设计历史本地数据迁移与跨设备合并。

每一步都必须继续保留用户的最终确认权，不把“完成任务”自动等同于“已经掌握”。
