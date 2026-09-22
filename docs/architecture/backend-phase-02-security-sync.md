# 后端第二阶段：认证、SQLite 与显式同步边界

本阶段不改变现有 Pixso UI、Planner、Tutor 或浏览器本地优先行为。它把四个底部模块的服务端基础从开发期文件快照升级为可迁移、可隔离、可测试的 SQLite 数据库。

## 认证与用户归属

- 所有 `/api/v1/*` 私人接口要求 `Authorization: Bearer <OIDC access token>`。
- 只接受固定 issuer 的 RS256 JWT；服务端校验签名、`kid`、`iss`、`aud`、`exp` 与 `nbf`，JWKS 只从部署配置的固定 URL 拉取。
- 内部 `users.id` 由服务端在已验证的 `iss + sub` 首次出现时创建。客户端从不提交可用的用户 ID；旧 `X-Xuecheng-User-Id` 会被拒绝。
- 未登录为 `401 identity_required`；伪造身份头为 `403 identity_override_forbidden`；带 token 但未部署 OIDC 配置为 `503 auth_not_configured`。

部署所需的非秘密配置位于 `.env.example`：`XUECHENG_OIDC_ISSUER`、`XUECHENG_OIDC_AUDIENCE`、`XUECHENG_OIDC_JWKS_URL`。实际身份提供商、Web 登录回调、TLS、密钥轮换和备份策略仍由部署环境提供；本仓库没有硬编码账号、共享密钥或生产默认用户。

## 数据库与迁移

运行时数据库是 `data/api/xuecheng.sqlite`（可用 `XUECHENG_DATABASE_PATH` 覆盖），迁移文件在 `apps/api/db/migrations/`：

- `schema_migrations`：已应用的迁移版本。
- `users`：已验证 OIDC 身份与内部用户 ID，包含 `data_version`。
- `home_snapshots`：同一份首页/用户模型的已筛选快照，不建立平行 Planner 模型。
- `calendar_events`：用户日程，含 AI 建议确认来源的唯一约束。
- `conversations`、`conversation_messages`：按用户隔离、可分页的确认后文字消息。
- `sync_audit`：只记操作类型、资源、版本、时间；不记录 token、消息正文、音频或模型密钥。

所有 SQL 使用预编译参数。更新、日程确认与消息幂等写入在 SQLite `BEGIN IMMEDIATE` 事务中完成；失败会回滚。测试为每个用例创建独立的临时数据库。

## 四模块 API 契约

所有成功响应为：

```json
{
  "data": {},
  "meta": { "api_version": "v1", "data_version": 4, "updated_at": "2030-01-01T08:00:00.000Z" }
}
```

响应附带 `ETag: W/"<data_version>"`。已有远端数据的整份首页写入、资料修改与日程写入要求 `If-Match`；版本不一致为 `409 sync_conflict`，缺失为 `428 sync_precondition_required`。消息使用 `client_message_id` / 可选同值 `Idempotency-Key`，不因网络重试重复创建。

| 模块 | 接口 | 持久化与冲突规则 |
| --- | --- | --- |
| 首页 | `GET/PUT /api/v1/home` | 一用户一份筛选快照；完整快照更新走版本控制。 |
| 对话 | `GET/POST /api/v1/conversations/{id}/messages` | `(用户, 会话, client_message_id)` 唯一；倒序查询、正序返回，最大 100 条/页。 |
| 日程 | `GET /api/v1/schedule`、创建/调整日程、确认建议 | `(用户, source_action_id)` 唯一；确认原子化且可重试。 |
| 我的 | `GET/PATCH /api/v1/profile` | 与首页共用筛选后的 preferences，不复制 User Model。 |

## 本地优先与同步范围

`GET /api/v1/sync/policy` 返回当前服务端同步政策，且必须登录后访问：

- 可以在用户明确发起时同步：首页筛选快照、低风险个人设置、确认日程、用户确认发送的文字消息。
- 永不自动上传：BYOK/API Key、原始录音、附件、二进制头像、资料来源原文、诊断日志。
- 未登录不会发请求；网络失败或版本冲突的显式同步返回失败结果，调用方不修改本地状态。
- 旧 `localStorage` 历史尚未接入上传。迁移 UI 必须由用户单独确认同步范围和目标账号后才可调用接口，不能静默批量上传。

浏览器侧的 `apps/web/lib/explicit-sync.js` 是尚未接入 UI 的无副作用基础模块，专门投影允许字段并在失败时保留本地状态。
