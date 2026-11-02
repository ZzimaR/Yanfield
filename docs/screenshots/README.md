# 产品截图

本目录存放 README 与发布页使用的产品截图，全部由维护者在本机无头浏览器里**真实截取**（用示例数据《潮信》，不合成、不 mock）。

## 清单

默认浅色「宣纸」主题；深色图为「夜航」主题。桌面图统一 1440×900。

| 文件 | 页面 | 要点 |
| --- | --- | --- |
| `01-home.png` | `/` | 本机首页：开始写作、使用帮助、常见问题。强调色为浅蓝 |
| `02-library.png` | `/library` | 书架：示例作品卡片、新建作品、观看进度 |
| `03-editor-blue.png` | `/editor/<novelId>?chapterId=<chapterId>` | 三栏写作工作台：目录树 + 正文 + AI 助手。选中项与按钮为浅蓝 |
| `04-ai-diff.png` | 同上 | AI 建议的逐块 diff 审阅态（最能体现差异化的一张） |
| `05-outline-blue.png` | `/novel/<novelId>/outline` | 三级大纲：总纲 / 卷纲 / 章纲。强调色为浅蓝 |
| `06-bible.png` | `/novel/<novelId>/bible` | 资料卡：角色、设定、伏笔，含 AI 可见性开关 |
| `07-archives.png` | `/novel/<novelId>/archives` | 故事档案：摘要、角色状态、资源总账、时间线 |
| `08-settings.png` | `/settings` | 设置页：模型、提示词、外观、数据 |
| `09-editor-dark.png` | 同 `03-editor-blue` | 深色「夜航」主题下的三栏工作台，强调色为浅蓝 |
| `10-provider-settings.png` | `/settings`（滚动到「模型服务」） | 快捷添加主流服务商：11 家预设、对话与写作分别配置模型、密钥掩码与「测试连接」 |
| `11-context-drawer.png` | 同 `03`（打开 AI 面板的「上下文」抽屉） | 上下文装配面板：分节 token 估算、上下文预算滑杆、超出预算被裁掉的维度 |
| `12-settings.png` | 书架页（点左下角齿轮） | 设置悬浮窗：左侧分区导航、模型服务 11 家预设。按钮为浅蓝 |

> 截图里的作品、角色与对话均为示例内容；仓库首次启动会自动生成，可随时用 `pnpm db:seed` 重置示例数据（不会删除你自建的作品）。

## 生成方式

截图脚本不会启动服务器，先在另一个终端把应用跑起来：

```bash
pnpm dev
```

再在仓库根目录执行：

```bash
# 01–09（含深色编辑器），默认 1440×900、浅色主题
node scripts/capture-screenshots.mjs

# 只补某几页 / 指定尺寸 / 追加深色图
node scripts/capture-screenshots.mjs --only library,settings
node scripts/capture-screenshots.mjs --dark
node scripts/capture-screenshots.mjs --width 390 --height 844 --only editor
```

`04-ai-diff.png` 依赖一次真实的 AI 任务：`scripts/capture-diff-screenshot.mjs` 会在编辑器里发起「续写」、打开逐块审阅后截图（不会把结果写进正文，可安全对示例数据运行）：

```bash
node scripts/capture-diff-screenshot.mjs
node scripts/capture-diff-screenshot.mjs --novel nov_xxx --chapter chp_yyy
```

`10-provider-settings.png`、`11-context-drawer.png` 与 `12-settings.png` 同样由脚本自动完成交互后截取（滚动到「快速添加主流服务商」网格 / 打开 AI 面板的「上下文」抽屉 / 点齿轮打开设置悬浮窗），可单独重截：

```bash
node scripts/capture-screenshots.mjs --only provider-settings,context-drawer,settings-dialog
```

## 替换到 README

[`README.md`](../../README.md) 引用 `03-editor-blue.png` 等当前文件名。重新截图后覆盖同名文件；如果 GitHub 页面仍显示旧图，换一个文件名再改 README 里的链接。

注意：截图里不要出现真实 API Key（设置页会掩码显示，但仍建议用示例 Key 或离线演示模式截图）。
