# 后端模块 02：对话

本模块对应 React 设计中的空对话、普通消息与任务建议画板，以及现有 iPhone 前端的对话 Tab。它只做可靠的**文字消息同步**，不替换既有 Planner、Tutor 或原生语音识别。

## 接口

- `GET /api/v1/conversations/{conversationId}/messages?limit=50&before={messageId}`：按时间顺序读取文字消息。
- `POST /api/v1/conversations/{conversationId}/messages`：写入一条已确认发送的文字消息。

每条写入必须带稳定的 `client_message_id`，可同时带相同值的 `Idempotency-Key`。网络重试同一内容会返回已有消息，不会复制；同一 ID 对应不同内容会返回 `409 message_id_conflict`。每页最多 100 条，`before` 是上一页最早一条消息的 ID。

## 与语音及任务建议的关系

- 录音、取消、识别中与权限弹窗是设备侧状态，不进入此 API。
- 只有识别完成、用户确认后的文本可以以 `source: "voice_transcript"` 写入。
- 不接收 `audio`、`audio_url` 或 `attachments` 字段；文件和录音需要独立、显式授权的模块。
- 已有本地 Agent 仍拥有 Planner/Tutor 状态。服务端同步到的 `assistant` 文本不构成“掌握”或“已完成”的证据。

## 数据边界

消息保存在独立的 SQLite `conversation_messages` 表，并以 `(内部用户 ID, conversation ID, client_message_id)` 唯一约束保证幂等；首页快照更新不会触碰消息。消息保存上限为每个会话最近 500 条，读取页最大 100 条。

## 尚未接入前端的原因

当前产品仍是本地优先。前端尚未接入自动上传；只有未来用户明确触发、已登录且确认同步范围后，才可调用本接口。原始语音、附件和模型密钥永远不会经由本模块同步。
