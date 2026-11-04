# 产品截图

本目录包含运行界面截图和历史图片。[README](../../README.md) 顶部使用的 `workspace-overview.svg` 是功能示意图，不是应用截图。

当前截图使用独立示例数据库中的虚构书稿与资料。Agent 候选、正文审阅和用量明细使用本地构造的模拟响应和数据，只展示交互，不代表真实模型效果或服务商价格；没有向真实模型发送书稿。浅色为「宣纸」，深色为「夜航」。图片按实际视口或窗口截取，尺寸不统一。

## 当前界面

| 图片 | 展示内容 |
| --- | --- |
| [25-workspace.png](./25-workspace.png) | 三栏写作台、章节目录与统一 AI 助手 |
| [05-outline-blue.png](./05-outline-blue.png) | 写作台「章纲」页签、总纲与分卷章节 |
| [07-archives.png](./07-archives.png) | 故事档案、过期状态与待确认冲突 |
| [10-provider-settings.png](./10-provider-settings.png) | 模型服务设置：协议/地址预设、离线演示服务与统一默认模型 |
| [11-context-drawer.png](./11-context-drawer.png) | 上下文预览、分节开关、预算与输出上限 |
| [12-settings.png](./12-settings.png) | 设置悬浮窗与模型服务入口 |
| [13-agent-workbench.jpg](./13-agent-workbench.jpg) | Agent 任务卡与待确认正文候选 |
| [15-usage-details.jpg](./15-usage-details.jpg) | 模拟的 token、缓存和费用来源明细 |
| [17-card-reference.jpg](./17-card-reference.jpg) | 从资料编辑窗口引用当前角色 |
| [20-card-editor-focus.jpg](./20-card-editor-focus.jpg) | 角色编辑窗口与统一 AI 助手入口 |
| [21-review-dark.jpg](./21-review-dark.jpg) | 深色主题正文审阅 |
| [22-review-light.jpg](./22-review-light.jpg) | 浅色主题正文审阅；README 展示图 |
| [24-ai-menu.jpg](./24-ai-menu.jpg) | 正文工具栏的 AI 快捷任务菜单 |

## 历史截图

`01-home.png`、`02-library.png`、`03-editor-blue.png`、`04-ai-diff.png`、`06-bible.png`、`08-settings.png`、`09-editor-dark.png`、`14-card-editor.jpg`、`16-agent-dark.jpg`、`18-inline-review.jpg`、`19-public-intro.jpg` 保留为早期界面记录，不作为当前操作指南。特别是旧设置图可能显示已废弃的推荐模型或双模型配置。

## 重拍方式与注意事项

1. 在**没有真实 API Key 的独立项目副本**中，设置一个全新的 `YANFIELD_DB_PATH` 并启动应用；确认使用离线演示服务，避免连接真实服务或把真实书稿、密钥拍入图片。可参考 [贡献指南的隔离数据库步骤](../../CONTRIBUTING.md)。
2. 等待页面、资料和统计加载完成，再手动打开需要展示的面板、窗口或主题后截图。检查文字清晰、没有加载骨架、遮挡或多余留白。
3. 多步 Agent 不支持离线演示模型。如需展示 Agent 候选，使用独立的本地模拟响应和示例书稿，并在说明中注明是模拟数据；不要把它描述成真实模型效果。
4. 截图完成后停服，再按需清理明确指定的临时数据库及其 WAL 文件。不要使用正式数据库生成截图。

> **示例数据警告**：设置页的「重新生成示例作品」只新增示例；`pnpm db:seed` 会删除作者为「砚田示例」或标题为《潮信》《长夜行》的作品，包括同名自建作品，并删除内置提示词预设。执行前必须停服并备份；只有库中没有任何作品时才自动创建示例。

## 旧脚本的限制

`scripts/capture-screenshots.mjs` 与 `scripts/capture-diff-screenshot.mjs` 是旧版截图脚本，不保证适配现在的路由、上下文按钮或 Agent 审阅流程；可能截到加载骨架或找不到旧按钮。演示模型也不能替代多步 Agent。不要依赖它们直接重建上表的当前截图；如果用于探索旧界面，务必使用隔离数据库并逐张检查结果。

替换图片后检查 [README](../../README.md) 等引用是否仍有效，并确保说明与截图内容一致。
