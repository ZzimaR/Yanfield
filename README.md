# 砚田 Yanfield

本地优先、源码公开的 AI 长篇小说创作工作台。书稿、设定与灵感都留在你自己的电脑里；模型随你换；每一处 AI 改动都由你点头才落笔。

[![License: Noncommercial](https://img.shields.io/badge/License-Noncommercial-a97f2b)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522.13-3c873a)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-100%20passing-2f5d62)](tests)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed)](Dockerfile)

> **状态：v0.1.0 开发中，尚未发布正式版本。** 功能已能完整跑通，但接口和界面仍可能调整，欢迎试用与反馈。

## 快速开始

需要 Node.js ≥ 22.13（自带 `node:sqlite`，不用开实验标志）。不需要 Docker、MongoDB 或 Redis。

```bash
git clone https://github.com/ZzimaR/Yanfield.git
cd Yanfield
pnpm install
pnpm dev
```

打开 http://127.0.0.1:3000 。第一次启动会自己建数据库，并放进示例作品《潮信》，可以直接写。

接模型可以等写完再做。左下角齿轮打开设置，选 DeepSeek（或其他 OpenAI 兼容服务），粘贴 API Key 即可。也可以把 `.env.example` 复制成 `.env`，填一个 `*_API_KEY`，下次启动会自动建好服务。细节见 [docs/ai-providers.md](docs/ai-providers.md)。

![写作台](docs/screenshots/03-editor-blue.png)

## 为什么做这个

写中文长篇，最难的不是写，而是「记住」：人设、设定、伏笔、前文细节、时间线，几十万字之后 AI 和作者本人都容易忘。

砚田的取舍是**本地优先**：

- 书稿、设定、AI 对话都存本地 SQLite（`data/yantian.db`），不依赖任何云端账号；
- 不绑定模型厂商，OpenAI 兼容 / Anthropic / Gemini / Ollama 都能接，对话和写作共用一个默认模型，随时可换；
- 上下文装配是可见、可调的——你决定哪些设定让 AI 看见、花多少 token；
- AI 对正文的改动一律先出**逐块 diff**，接受哪块、拒绝哪块由你决定。

## 已实现（v0.1.0 开发版）

**写作**
- 作品 / 卷 / 章三级结构，三栏沉浸写作台（目录 · 正文 · AI），自动保存、字数统计、专注模式
- 正文排版可调：衬线 / 黑体、字号、字重、行高、字间距、段落间距、页边距、最大行宽
- 浅色「宣纸」与深色「夜航」双主题，强调色为浅蓝；手机 / 平板响应式布局

**AI**
- 对话、起草、技能三种输入模式；8 个内置智能体（主编 / 策划 / 写作 / 档案 / 审稿 / 设定 / 考据 / 结构）+ 自定义智能体（共 9 种）
- `@` 引用章节、角色、设定；上下文预算（默认 12000 tokens，可设为不限）与逐节预览
- 内置提示词预设：续写、扩写、润色、去 AI 味、章节诊断、章纲、人物卡、世界观卡、故事档案提取等
- 兼容 OpenAI（含 DeepSeek / 通义 / Kimi / GLM / OpenRouter / SiliconFlow 等 OpenAI 兼容服务）、Anthropic、Gemini、Ollama，以及任意自定义 OpenAI 兼容网关
- 设置页内置 11 家主流服务商预设（选品牌自动填好 Base URL 与推荐模型）；可用 API Key 从服务商**拉取真实模型列表**，也可以手动添加任意模型 id
- **单一「默认模型」**：对话与写作任务都用同一个模型，随时切换（不再强制区分对话 / 正文模型）
- 也支持环境变量自动接入
- 没有 API Key 也能用「离线演示模式」走完整个流程（模板输出，不联网）

**资料与一致性**
- 三级大纲：总纲 / 卷纲 / 章纲（目标、POV、冲突、场景、钩子）
- 设定库：角色、世界观、伏笔，支持对 AI 可见性与揭示章节（防剧透）
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

Windows 上如果没有符号链接权限，构建时设置 `YANTIAN_STANDALONE=0`（或使用 Docker）。systemd / VPS / 反向代理 / 备份恢复等完整说明见 [docs/deploy.md](docs/deploy.md)。

## 项目结构

```
app/          页面与 REST / SSE 路由（Next.js App Router）
components/   UI（editor / ai / cards / outline / archives / settings / landing）
lib/          领域类型、SQLite 访问、repo、AI provider / 上下文装配 / 引擎、diff
scripts/      seed、截图脚本
tests/        vitest 用例（工具函数、diff、bridge、Provider 协议、环境变量注入）
docs/         功能、架构、模型服务、部署、常见问题、路线图
```

## 开发与测试

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest（100 个用例）
pnpm build       # 生产构建
pnpm db:seed     # 重新生成示例作品（不删用户数据）
```

重截文档截图：`node scripts/capture-screenshots.mjs`（自动探测本机 Edge / Chrome）。

## 技术栈

Next.js 15 · React 19 · TypeScript strict · Tailwind CSS v4 · Tiptap 3 · node:sqlite · SSE 流式输出

## 截图

<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/screenshots/01-home.png" alt="首页：开始写作、使用帮助与常见问题" width="480" /><br />
      <sub>首页：开始写作</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/screenshots/05-outline-blue.png" alt="三级大纲：总纲 / 卷纲 / 章纲" width="480" /><br />
      <sub>三级大纲</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/screenshots/09-editor-dark.png" alt="深色「夜航」主题下的三栏写作台，强调色为浅蓝" width="480" /><br />
      <sub>深色「夜航」，浅蓝强调</sub>
    </td>
    <td align="center" width="50%">
      <img src="docs/screenshots/12-settings.png" alt="设置悬浮窗：模型服务、11 家服务商预设与拉取模型列表" width="480" /><br />
      <sub>设置悬浮窗：模型服务、11 家预设、拉取模型列表</sub>
    </td>
  </tr>
</table>

更多截图（书架、设定、故事档案、上下文预算抽屉等）见 [docs/screenshots](docs/screenshots/)。

## 文档

- [功能说明](docs/features.md)
- [架构与数据模型](docs/architecture.md)
- [模型服务与接入](docs/ai-providers.md)
- [部署指南](docs/deploy.md)
- [常见问题](docs/faq.md)
- [路线图](docs/roadmap.md)

## 路线图

- **v0.1.0（当前，开发中）**：上面列出的写作、AI、资料与一致性能力；
- **v0.2（计划）**：章节版本快照与回滚、EPUB 导出、自定义 Agent 与插件机制、多人协作审校；
- **更远**：知识图谱页、爆款仿写工作台、AI 配图。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。Issue 与 PR 都欢迎；较大的改动请先开 issue 讨论。

## 许可

[PolyForm Noncommercial 1.0.0](LICENSE)。可以自己用、学习、修改和分享源码，不能用于商业目的。你用砚田写出的小说版权仍归你。代码与界面为干净重写；功能形态参考了中文网文写作场景的公开产品文档，未复制任何第三方源码。
