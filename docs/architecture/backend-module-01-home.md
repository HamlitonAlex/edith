# 后端模块 01：首页

这是把现有 iPhone 前端的**首页**从浏览器本地状态逐步迁移到服务端的第一段，不改变现有 Planner、Tutor、模型配置或本地优先体验。

## 范围

`GET /api/v1/home` 只返回首页需要的最小摘要：伙伴信息、下一步、下一条日程、路径摘要。
`PUT /api/v1/home` 接收同一份经过筛选的首页快照，并原子写入服务端。

当前前端的 `messages`、附件、`modelConfig`、API Key、资料授权和完整 Agent memory **不在此模块上传范围内**。它们仍按现有本地边界保存，后续对话、资料与模型模块分别定义授权和数据契约。

## 身份与部署边界

所有私人接口要求标准 `Authorization: Bearer <OIDC access token>`。服务端只在 RS256 签名、issuer、audience、有效期均通过校验后，从 token 的 `iss + sub` 建立内部用户归属；客户端提供的 `X-Xuecheng-User-Id` 会得到 `403 identity_override_forbidden`，不会参与数据查询。

开发命令：

```bash
npm run dev:api
```

默认地址是 `http://localhost:8787`，数据写入忽略版本控制的 SQLite 文件。`XUECHENG_DATABASE_PATH`、`XUECHENG_WEB_ORIGIN` 与三项 `XUECHENG_OIDC_*` 配置见根目录 `.env.example`。未配置 OIDC 时服务拒绝携带私密数据的请求，不会退化为默认账号。

## 数据所有权

- 前端：交互草稿、聊天全文、原始附件、设备本地模型密钥。
- 首页 API：展示所需的已筛选个人摘要；只按显式 `PUT` 同步，不主动读取设备数据。
- Planner/Tutor：仍由现有 Agent 内核拥有；本模块只映射其可展示的结果，不能通过 API 伪造“已掌握”。

## 失败行为

- 未提供有效身份：`401 identity_required`
- 已提供凭据但部署未配置身份提供商：`503 auth_not_configured`
- 尚未初始化首页：`404 home_not_initialized`
- 已有远端版本却不带 `If-Match`：`428 sync_precondition_required`
- 版本不一致：`409 sync_conflict`
- 无效或过大的快照：`422 invalid_snapshot` / `413 payload_too_large`
- 错误响应不含堆栈、文件路径或内部存储内容。

下一步按底部模块顺序实现：对话（可审计消息与同步队列）→ 日程（建议、用户确认、正式安排）→ 我的（偏好与授权）。
