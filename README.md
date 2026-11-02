# 砚田 Yanfield

本地部署、隐私优先的长篇小说创作工作台。书稿、设定与灵感都保存在你自己的电脑或服务器上，不依赖账号和云端平台；在此基础上接入 AI，辅助大纲、写作与资料管理，每一处 AI 改动都由你点头才落笔。

[![License: Noncommercial](https://img.shields.io/badge/License-Noncommercial-a97f2b)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522.13-3c873a)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-206%20passing-2f5d62)](tests)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed)](Dockerfile)

> **状态：v0.1.0 开发中，尚未发布正式版本。** 核心流程可试用，多步 Agent 需配置实际模型；接口和界面仍可能调整，欢迎试用与反馈。

## 快速开始

需要 Node.js ≥ 22.13（自带 `node:sqlite`，不用开实验标志）和 pnpm ≥ 9。不需要 Docker、MongoDB 或 Redis。

如果还没有 Node.js，先按系统安装：

- **Windows**：从 [Node.js 官网](https://nodejs.org) 下载 24 LTS 的 Windows Installer（`.msi`）并安装，保持默认选项即可。安装完成后打开 PowerShell，运行 `node --version` 和 `npm --version` 检查是否成功。
- **macOS**：从 [Node.js 官网](https://nodejs.org) 下载 24 LTS 的 macOS Installer（`.pkg`）并安装。安装完成后打开「终端」，运行 `node --version` 和 `npm --version` 检查是否成功。也可以使用 Homebrew：`brew install node@24`。

npm 会随 Node.js 一起安装，不需要单独下载。确认 npm 可用后，再安装 pnpm：

```bash
npm install --global pnpm@9
```

项目使用 pnpm 管理依赖并锁定版本；虽然 npm/yarn 在部分情况下也能安装，但不建议混用。

```bash
git clone https://github.com/ZzimaR/Yanfield.git
cd Yanfield
pnpm install
pnpm dev
```

打开 http://127.0.0.1:3000 。第一次启动会自己建数据库，并放进示例作品《潮信》，可以直接写。

接模型可以等写完再做。左下角齿轮打开设置，选 DeepSeek（或其他 OpenAI 兼容服务），粘贴 API Key 即可。也可以把 `.env.example` 复制成 `.env`，填一个 `*_API_KEY`，下次启动会自动建好服务。细节见 [docs/ai-providers.md](docs/ai-providers.md)。

[![写作台功能示意：资料、正文与可审阅的 AI 修改](docs/screenshots/workspace-overview.svg)](docs/screenshots/workspace-overview.svg)

主图为可缩放的矢量功能示意，放大仍可清楚阅读；真实界面见下方[截图](#截图)。

## 本地部署，隐私优先

砚田首先是一个本地运行的写作工具，其次才是 AI 创作助手。你可以把它部署在自己的电脑、家庭服务器或自有 VPS 上，作品数据和配置由你自己掌控。

- 书稿、设定、AI 对话与 API Key 都保存在本地 SQLite 中，不需要注册、登录或订阅；
- 没有遥测、云同步或砚田自有服务器，只有你主动配置的模型服务会收到请求；
- 支持离线模板演示；多步 Agent 需配置实际模型。也可以连接本机 Ollama，让内容不离开自己的设备；
- 源码公开、部署方式透明，数据文件可以自行备份、迁移和检查。

## 为什么加入 AI

写中文长篇，最难的不是写，而是「记住」：人设、设定、伏笔、前文细节、时间线，几十万字之后 AI 和作者本人都容易忘。

在本地数据掌控的前提下，砚田提供 AI 辅助：

- 不绑定模型厂商，OpenAI 兼容 / Anthropic / Gemini / Ollama 都能接，助手与写作任务共用默认模型，随时可换；
- 上下文装配是可见、可调的——哪些资料进入上下文、花多少 token，都能在设置和预览里看到；
- 助手能按需读资料、多步执行，提出正文和资料改动；正文在写作区逐处高亮审阅，资料按字段对比。确认后批量写入，也可撤回。见[正文审阅截图](docs/screenshots/18-inline-review.jpg)。

## 已实现（v0.1.0 开发版）

**写作**
- 作品 / 卷 / 章三级结构，三栏沉浸写作台（目录 · 正文 · AI），自动保存、字数统计、专注模式
- 写作台左栏四页签：目录 · 章纲 · 设定 · 档案；章纲、设定、档案都在浮窗里就地编辑，不离开正文
- `Ctrl / ⌘ K` 快速跳转：搜章节、角色、设定、档案，或直接切换左栏页签；`Alt + J` 聚焦右侧 AI；`Ctrl / ⌘ + Shift + 1–4` 直达左栏四个页签；旧的大纲 / 设定 / 档案页面会自动跳回写作台
- 正文排版可调：衬线 / 黑体、字号、字重、行高、字间距、段落间距、页边距、最大行宽
- 浅色「宣纸」与深色「夜航」双主题，采用沉稳的墨蓝强调色；手机 / 平板响应式布局

**AI**
- 右侧统一 Agent 助手：续写、改稿、建卡、修改设定和整理章纲都在同一对话中执行；保留技能预设、文风选择与可自定义的人设
- 对话会用第一条提问自动命名，历史中的默认标题也会从消息中补出；空会话保留「新对话」
- `Enter` 发送、`Shift + Enter` 换行；点「技能」在输入框内展开技能清单，选中后自动填好提示词
- `@` 引用章节、角色、设定、伏笔和档案；可配置上下文预算与逐节预览
- 运行卡片显示执行过程、引用资料、正文候选和资料改动；可选择条目或字段应用，服务端校验版本并以事务写入
- 写完正文会整理有原文依据的资料候选，匹配姓名和别名以减少重复；自动整理只补已有卡的空白，不覆盖作者事实
- 用量收进输入框底部的小状态行与消息明细图标。可识别的接口费用保留原币种；未返回费用时按配置单价明确标为预估，未设单价显示未知。今日汇总是预估，不是账户账单
- 内置提示词预设：续写、扩写、润色、去 AI 味、章节诊断、章纲、人物卡、世界观卡、故事档案提取等
- 兼容 OpenAI（含 DeepSeek / 通义 / Kimi / GLM / OpenRouter / SiliconFlow 等 OpenAI 兼容服务）、Anthropic、Gemini、Ollama，以及任意自定义 OpenAI 兼容网关
- 设置页内置 11 家主流服务商预设（选品牌自动填好 Base URL 与推荐模型）；可用 API Key 从服务商**拉取真实模型列表**，也可以手动添加任意模型 id
- **统一模型配置**：在设置或 AI 面板切换默认模型；规划、正文写作与资料整理分别调用并计入本轮用量
- 也支持环境变量自动接入
- 没有 API Key 时可使用离线模板功能；多步 Agent 需要配置实际模型，演示模型不会假装执行任务

**资料与一致性**
- 三级大纲：总纲 / 卷纲 / 章纲（目标、POV、冲突、场景、钩子）
- 设定库：角色、世界观、伏笔；卡片展示身份、性格、目标和标签，资料弹窗使用档案排版与分类页签
- 弹窗左上角只保留一个「AI 助手」入口：打开写作台助手并自动 @ 当前卡片，带上未保存草稿，不自动发送；不再为每个字段重复放 AI 按钮
- 资料可标记「尚未揭示」提醒助手避免提前泄露，也可关闭「AI 可见性」禁止工具读取
- 故事档案：本章摘要、人物状态、设定变动、总账、时间线、待确认冲突，改章自动标记过期
- TXT 导入（正则拆章、预览后落库）、Markdown / TXT 导出

## 部署

```bash
# Docker Compose（数据持久化到 ./data；先建目录，避免容器以 root 创建后无写权限）
mkdir -p data
docker compose up -d --build

# 或 Node 直接跑
pnpm build
pnpm start
```

Windows 上如果没有符号链接权限，构建时设置 `YANFIELD_STANDALONE=0`（或使用 Docker）。systemd / VPS / 反向代理 / 备份恢复等完整说明见 [docs/deploy.md](docs/deploy.md)。

## 项目结构

```
app/          页面与 REST / SSE 路由（Next.js App Router）
components/   UI（editor / ai / cards / outline / archives / settings / landing）
lib/          领域类型、SQLite 访问、repo、AI provider / 上下文装配 / 引擎、diff
scripts/      seed、截图脚本
tests/        vitest 用例（工具函数、diff、bridge、Provider 协议、环境变量注入、资料助手、上下文披露）
docs/         功能、架构、模型服务、部署、常见问题、路线图
```

## 开发与测试

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest（206 个用例）
pnpm build       # 生产构建
pnpm db:seed     # 重新生成示例作品（不删用户数据）
```

旧版页面截图脚本：`node scripts/capture-screenshots.mjs`（自动探测本机 Edge / Chrome）。真实界面原图与资料窗口近景保存在 `docs/screenshots/`；重新截图时优先截取需要说明的区域，按原尺寸展示，不把整屏文字缩成两栏。

## 技术栈

Next.js 15 · React 19 · TypeScript strict · Tailwind CSS v4 · Tiptap 3 · node:sqlite · SSE 流式输出

## 截图

介绍页也可在本地 `/intro` 预览。新版介绍页围绕本地保存、免费自托管、自带 API 和可审阅的 AI 修改展开；写作台演示直接渲染文字，支持切换正文与改动视图。

资料弹窗单独展示，保留原始尺寸，不再把整屏文字挤进两栏小图。点击图片可查看原图。

[![资料编辑窗口：统一 AI 助手入口与档案排版](docs/screenshots/20-card-editor-focus.jpg)](docs/screenshots/20-card-editor-focus.jpg)

其余界面保留完整原图，按需打开：

- [三栏写作台与 Agent 改动回执](docs/screenshots/13-agent-workbench.jpg)
- [正文中的逐处修改审阅](docs/screenshots/18-inline-review.jpg)
- [用量与费用来源明细](docs/screenshots/15-usage-details.jpg)
- [深色「夜航」写作台](docs/screenshots/16-agent-dark.jpg)
- [资料自动 @ 引用](docs/screenshots/17-card-reference.jpg)
- [介绍页](https://yanfield.com/)

真实截图使用独立示例书稿与本地模拟模型，费用不代表真实服务商价格。主图为简化的功能示意，不是运行截图。历史界面原图见 [docs/screenshots](docs/screenshots/)。

## 文档

- [Agent 工作流、改动审阅与用量说明](docs/agent-workflow.md)

- [功能说明](docs/features.md)
- [架构与数据模型](docs/architecture.md)
- [长篇性能检查与当前边界](docs/performance-audit.md)
- [模型服务与接入](docs/ai-providers.md)
- [部署指南](docs/deploy.md)
- [常见问题](docs/faq.md)
- [路线图](docs/roadmap.md)

## 路线图

- **v0.1.0（当前，开发中）**：上面列出的写作、AI、资料与一致性能力；
- **v0.2（计划）**：章节版本快照与回滚、EPUB 导出、插件机制与更多内置工作流、多人协作审校；
- **更远**：知识图谱页、爆款仿写工作台、AI 配图。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。Issue 与 PR 都欢迎；较大的改动请先开 issue 讨论。

## 许可

[PolyForm Noncommercial 1.0.0](LICENSE)。你可以自行使用、学习、修改和分享本项目源码，但不得将本项目用于商业目的（包括部署后以任何形式向用户收费）。使用砚田创作的小说，其版权仍归作者所有。代码与界面均为独立重写；功能形态参考了中文网文写作场景中的公开产品文档，未复制任何第三方源码。
