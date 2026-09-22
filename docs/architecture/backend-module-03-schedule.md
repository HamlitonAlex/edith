# 后端模块 03：日程

本模块对应设计文件中的日程时间轴、已确认日程、当前进行中安排和 AI 建议等待确认状态。

## 接口

- `GET /api/v1/schedule?date=YYYY-MM-DD`：返回当天已确认日程和一条可确认的 AI 建议。
- `POST /api/v1/schedule/suggestions/{actionId}/confirm`：用户选择时间后，将当前建议写为正式日程。
- `POST /api/v1/schedule/events`：创建手动日程。
- `PUT /api/v1/schedule/events/{eventId}`：调整手动日程。

## 关键状态闭环

`next_recommended_action` 仅是 `pending_suggestion`，不会自动进入 `events`。只有确认接口成功后，服务端才创建 `source: "confirmed-ai-suggestion"` 的 `confirmed` 日程。重复确认不会复制日程。

手动日程由用户直接修改；由 AI 建议确认生成的日程不能被此接口静默重写，必须回到对话或重新安排，避免系统把协商结果误改成既定计划。

## 时间与边界

输入可使用 iCalendar 紧凑时间（如 `20300101T140000`）或带时区的 ISO-8601 时间。日程不接收未确认的附件、外部日历或自动执行指令；这些连接器仍需单独授权。

本模块继续复用首页快照中的 Agent 输出和日程集合，不创建平行 Planner 或第二份用户模型。

首次首页同步可以初始化日程；一旦用户通过日程接口创建、确认或调整安排，服务端会成为日程集合的写入方。之后过期的首页快照不能覆盖已确认的服务端日程，避免跨端同步时丢失安排。

日程使用 SQLite 事务、`(用户, source_action_id)` 唯一索引和 `If-Match` 数据版本控制。确认失败会整体回滚；同一确认请求重试会返回既有日程，而不会新增第二条。
