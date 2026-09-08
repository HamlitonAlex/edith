# 采集端接入约定

采集器只负责描述“观察到的信号”，不负责宣布用户已经学习、掌握或形成某项能力。Android、Apple Shortcuts、日历和未来课程连接器都向事件服务提交同一种结构。

## 必填信息

- `event_id`：由设备或连接器稳定生成；重试时保持相同，服务据此去重。
- `occurred_at`：事件发生时间，包含时区；不得用服务器接收时间替代。
- `source`：采集方式与用户可理解的来源名称。
- `actor`：事件涉及的人；家庭中不能把家长观察写成孩子自述。
- `kind`：`plan`、`behavior`、`self_report`、`artifact` 或 `inference`。
- `content`：事件最小摘要；原始文件可以保留在设备或独立对象存储中。
- `visibility`：`private`、`shared` 或 `guardian`。
- `consent_scope`：产生本事件所依据的授权范围。

系统生成的 `inference` 还必须有 `inference_status`，初始值为 `pending`。只有人的决定能把它改为 `confirmed` 或 `rejected`。

## 设备端职责

1. 先按用户选择的应用和字段过滤，再发送事件。
2. 不上传完整通知收件箱、通讯录、精确位置历史或无关内容。
3. 离线时进入本地队列；重试保持原事件编号。
4. 保存采集权限和来源，使用户能回答“为什么系统知道”。
5. 连接中断时报告数据缺口；不能把“没有采到”写成“没有发生”。

## 三个示例

- [`calendar-plan.json`](../../examples/events/calendar-plan.json)：日历只能产生计划记录。
- [`android-usage.json`](../../examples/events/android-usage.json)：前台时长只能产生行为信号。
- [`apple-shortcut-voice.json`](../../examples/events/apple-shortcut-voice.json)：主动语音作为本人陈述。

这些文件由自动测试读取；对协议的修改必须同步更新示例和测试。

## Apple Shortcuts 首期流程

“说一句”快捷指令取得听写文本，创建事件编号与带时区时间，把 JSON 发送到用户自建的 `/events` 接口。服务只需返回已接收的事件编号。快捷指令显示“已收到”，不继续追问。

“分享到学程”快捷指令接收系统分享内容，先询问可见范围，再上传最小摘要或文件引用。日历摘要自动化只读取标记为学习的事件，按天批量提交。

## Android 首期流程

默认使用系统分享、快捷设置和本地活动计时。UsageStats 与通知读取位于单独的实验权限页；用户选择来源白名单后，设备端把原始系统事件转换成最小行为事件。服务端永远不接收未过滤的通知流。
