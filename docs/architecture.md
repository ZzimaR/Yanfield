# 砚田架构设计

> 面向贡献者的技术文档。产品视角的功能说明见 [features.md](./features.md)，AI 供应商配置见 [ai-providers.md](./ai-providers.md)。
> 本文件描述 0.1.0（开发中，未发布）的架构与取舍；接口契约的权威来源是 [architecture/CONTRACTS.md](./architecture/CONTRACTS.md)。

## 一句话

砚田是一个**单进程、单用户、本地优先**的 Next.js 应用：浏览器负责编辑与审阅，Next.js 服务端负责持久化与 AI 调用，全部数据落在一个 SQLite 文件里。没有账号体系、没有消息队列、没有对象存储，`pnpm dev` 或 `docker run` 一条命令即可跑起来。

## 技术栈

| 层 | 选型 | 为什么 |
| --- | --- | --- |
| 全栈框架 | Next.js 15 App Router + React 19 | 一个进程同时提供页面与 REST/SSE 接口，部署面最小；Server Components 让首屏直接读 SQLite。 |
| 语言 | TypeScript strict | 领域模型（作品/卷/章/资料卡/档案）字段多，类型是第一道防线。 |
| 样式 | Tailwind v4 + CSS 变量设计 token | 双主题（宣纸/夜航）只换变量；工具类在 `app/globals.css` 的 `@theme inline` 里绑定。 |
| 编辑器 | Tiptap 3 | 结构化 HTML 正文是 diff 与导出（Markdown/TXT）的基础；ProseMirror 生态成熟。 |
| 存储 | `node:sqlite`（Node ≥ 22.13 内置） | 零原生依赖、零安装；单文件可备份、可直接用 sqlite3 打开检查。 |
| AI | 自研可插拔 Provider 层 | 五种连接方式（OpenAI 兼容 / Anthropic / Gemini / Ollama / 演示）统一成一条 SSE 事件流。 |
| 测试 | Vitest（node 环境） | 覆盖纯函数层（字数统计、diff 引擎、文本转 HTML、费用估算）、Provider 协议解析（`node:http` 起本地假上游模拟 SSE）、拉取模型列表（/models 解析）、环境变量自动建 Provider（临时 SQLite）、资料助手（codex 清单解析与合并）、揭示章节与 `aiVisible` 可见性边界、智能体系统提示词的知识边界、人设覆盖合并与校验；不需要真实 Key。 |

## 运行形态

```text
┌──────────────────────────── 浏览器 ────────────────────────────┐
│  App Router 页面（RSC + Client Components）                     │
│  /    /library    /editor/[id]    /novel/[id]/...    /settings │
│  Tiptap 编辑器 · AI 面板 · Diff 审阅抽屉                        │
└───────────────┬──────────────────────────────┬─────────────────┘
                │ fetch JSON (REST)            │ fetch + ReadableStream (SSE)
┌───────────────▼──────────────────────────────▼─────────────────┐
│                     Next.js 服务端（Node runtime）              │
│  app/api/**/route.ts   → lib/repo.ts（同步 SQLite 访问）        │
│  app/api/ai/**/route.ts → lib/ai/context → prompts → engine    │
│                              → lib/ai/provider → 上游 API      │
└───────────────┬──────────────────────────────┬─────────────────┘
                │                              │
        data/yanfield.db                 用户配置的模型服务
        （node:sqlite，WAL）           （OpenAI / Anthropic / Gemini / Ollama…）
```

关键点：

- **服务端是唯一写入口**。浏览器不直接读写 SQLite，所有变更走 `/api/*`，因此数据一致性只需在一处保证。
- **同步驱动**。`node:sqlite` 的 `DatabaseSync` 是同步 API，本地单用户场景下延迟在微秒级，比引入异步池更简单；代价是长查询会阻塞事件循环（见「取舍」）。
- **无状态页面**。页面数据全在服务端按需读取，前端用 `lib/client/api.ts` 的 `useApi` 拉取与 `notifyDataChanged` 事件做失效刷新。

## 目录结构（核心部分）

```text
app/
  layout.tsx                 # <html data-theme>、字体、ToastProvider、主题脚本
  globals.css                # 设计 token（宣纸/夜航）、@theme 映射、.prose-paper 等工具类
  page.tsx                   # 本机首页（开始写作）；公开站同一路由换成介绍页
  library/                   # 书架
  novels/[id]/               # 作品概览（门厅）；大纲 / 设定 / 档案旧页面 307 重定向到写作台页签
  editor/[id]/               # 写作台：左栏 目录·章纲·设定·档案（就地浮窗编辑）+ 正文 + 右栏 AI；⌘K 快速跳转
  settings/                  # 模型、提示词、智能体（人设/prompt 覆盖）、外观、数据
  api/
    novels/…                 # 作品、卷、章、树、导入导出
    ai/agent|chat|task|context|codex|archives/extract  # Agent、传统任务、档案与上下文预览
    providers/ presets/ settings/ stats/ search/
lib/
  types.ts                   # 全部领域类型与常量（智能体、标签、默认配置）
  db/index.ts                # node:sqlite 单例、schema、事务辅助
  repo.ts                    # 所有 SQL 都在这里（camelCase 领域对象出入口）
  seed.ts                    # 首启引导：内置预设、演示 Provider、示例作品（幂等）
  defaults.ts                # 内置提示词预设、示例作品内容
  ai/context.ts              # 上下文装配器（按维度裁剪 + token 预算）
  ai/agent/                  # 多步规划、按需读取、候选、事务应用与撤回
  ai/prompts.ts              # 模板渲染、智能体人设、JSON 提取、文本↔HTML
  ai/engine.ts               # 对话/任务编排、SSE 事件生产、AI 日志
  ai/provider.ts             # 五类 Provider 适配 + 统一 chunk 流
  client/api.ts              # 前端 fetch / SSE 客户端
  diff/blocks.ts             # 块级 + 行内 diff 与「按块应用」
  editor/bridge.tsx          # 编辑器能力桥（插入/替换/聚焦）
  ui/                        # 设计系统组件、hooks、cn、theme
components/                  # layout/（AppShell）、ui/（kit）、ai/、landing/、编辑器与页面组件
tests/                       # Vitest 纯函数单测
scripts/
  seed.mjs                   # pnpm db:seed：按示例作者/标题删除作品及内置预设，可能误删同名作品
  capture-screenshots.mjs    # 旧版页面截图脚本，不保证适配新版界面
deploy/
  yanfield.service            # VPS + systemd 服务模板（见 docs/deploy.md）
Dockerfile .dockerignore     # 多阶段构建 → standalone 产物，非 root 运行
docker-compose.yml .env.example
.github/                     # CI、Issue 模板、PR 模板
```

## 数据模型

数据库文件默认 `data/yanfield.db`（`YANFIELD_DB_PATH` 可覆盖）。启用 `WAL` 与 `foreign_keys`，JSON 字段以 TEXT 存储、在 `lib/repo.ts` 边界解析。所有表主键为字符串 ID（`uid("nov")` 形式），时间为 ISO 8601 字符串。

| 表 | 作用 | 关键字段 / 关系 |
| --- | --- | --- |
| `novels` | 作品 | 标题、副标题、作者、类型（`GENRES`）、标签、简介、封面色 `coverKey`、连载状态、目标字数、视角、文风约束、禁用词 |
| `volumes` | 卷 | `novelId` → novels（级联删除）、卷名、卷序号 |
| `chapters` | 章 | `volumeId` → volumes、正文 HTML `content`、章摘要、状态（草稿/修改中/定稿）、排序、字数 |
| `novel_outlines` | 总纲 | 一句话前提、主题、基调、主线、支线、角色弧、世界规则、结局、钩子 |
| `volume_outlines` | 卷纲 | 卷摘要、卷弧目标、关键事件、伏笔计划 |
| `chapter_blueprints` | 章纲 | 本章目标、视角、冲突、情绪曲线、场景列表、情节节点、结尾钩子、目标字数 |
| `characters` | 角色卡 | 别名、身份、外貌、性格、目标、秘密、弧光、说话风格、关系网、当前状态、`aiVisible`、`revealAtChapter` |
| `world_settings` | 设定卡 | 分类（力量体系/地理/势力/物品/规则/历史/自定义）、父级、标签、`aiVisible`、揭示章节 |
| `foreshadows` | 伏笔卡 | 埋设章节、状态（已埋设/推进中/已回收/已放弃）、回收计划、关联角色 |
| `story_archives` | 故事档案 | 本章摘要、角色状态、设定状态、资源总账（`ledger`）、时间线、伏笔、冲突；`status` 最新/已过期/待确认、`generatedBy`/`model` |
| `chat_sessions` | AI 对话会话 | 作品、标题、绑定智能体、当前模式 |
| `chat_messages` | 对话消息 | 会话 → 级联删除；角色、内容、推理内容、usage、命中的模型与动作 |
| `providers` | 模型服务 | 类型（openai/anthropic/gemini/ollama/demo）、名称、baseUrl、密钥（本地明文）、模型列表、启用状态 |
| `prompt_presets` | 提示词预设 | 功能（`AiFeature`）、system/user 模板、温度、模型角色（chat/prose）、是否内置、是否启用 |
| `ai_logs` | AI 调用日志 | 功能、智能体、模型、token、耗时、成功/错误码，用于成本与排障 |
| `app_settings` | 键值设置 | 主题、编辑器字号/行高/排版、自动保存延迟、每日目标、默认上下文配置、统一默认模型、自定义智能体与人设覆盖（`agentOverrides`） |
| `word_snapshots` | 每日字数快照 | 日期、累计字数、AI token 数，用于写作曲线 |

关系上只有两条强约束：**作品 → 卷 → 章**、**会话 → 消息**，其余资料通过 `novelId` / `chapterId` 软关联，删作品时由 `ON DELETE CASCADE` 清理。

**种子数据与重置**：`lib/seed.ts` 的 `ensureReady()` 在服务端首次触达数据库时执行，依次初始化内置提示词预设、默认设置、演示 Provider 和环境变量 Provider，并仅在库中没有任何作品时写入示例作品《潮信》。环境变量初始化按服务商预设创建 Provider；品牌服务的模型列表为空，需主动拉取或手动添加；已有同名服务不覆盖。如果默认模型指向演示服务，会切到第一个新建服务，但该服务可能尚无模型。自定义兼容环境变量未指定模型时会保留 `gpt-4o-mini` 占位。

`pnpm db:seed`（`scripts/seed.mjs`）会删除作者为「砚田示例」**或标题为《长夜行》《潮信》**的作品（包括同名自建作品，子表级联删除），并删除所有内置预设，内置预设中的改动可能丢失。执行前必须停服并备份；重新启动会重建内置预设，但只有库中没有任何作品才自动创建示例。设置 → 数据里的「重新生成示例作品」通过 `POST /api/demo` 新增一部示例，不删除已有内容。

## REST 与 SSE

- 所有 REST 接口返回 JSON；列表统一 `{ items: T[] }`，错误统一 `{ error: string }` + 4xx/5xx。
- Agent、对话、任务与档案提取使用流式接口（`text/event-stream`）；上下文预览等接口返回 JSON。请求体在路由层校验，业务分别在 `lib/ai/agent/` 与 `lib/ai/engine.ts`。
- 前端 `lib/client/api.ts` 的 `streamAiChat` / `streamAiTask` 把 SSE 解析成回调，页面只消费 `meta / delta / reasoning / action / done / error` 事件。
- AI 路由显式声明 `export const runtime = "nodejs"` 与 `dynamic = "force-dynamic"`：需要 Node 的 `node:sqlite` 与长连接，不能走 Edge 或静态化。

## AI 请求链路

写作台统一 Agent 从提交请求到落库，主要经过六步：

```text
① 请求          POST /api/ai/agent  携带作品、章节、消息、引用、选区和上下文配置
② 规划与读取    lib/ai/agent/run.ts  按需查询目录、正文、大纲、资料与档案，校验可见性
③ 生成候选      写手流式生成正文；资料工具暂存字段候选，正文后可整理有依据的资料
④ Provider      lib/ai/provider.ts  按 kind 组 URL、鉴权并归一化流式事件；
                 模型窗口已知时检查输入估算与输出预留
⑤ 事件流        Agent SSE 发送进展、草稿、候选、用量和错误；运行记录持久化
⑥ 审阅与落库    作者选择正文改动或资料字段，POST /api/ai/agent/[id]/apply；
                 服务端校验版本、事务写入，未经确认不改正文或资料
```

传统单点任务仍使用 `/api/ai/task`、上下文装配与对应提示词模板；详情见 [Agent 工作流](./agent-workflow.md)。

### 上下文装配器

`assembleContext()` 把预览和传统任务的作品资料组织成可检查、可预算的显式结构：

- 每个维度产出一个 `sections[]` 条目（id、中文标题、文本、估算 token、优先级），前端可原样展示。
- `includeChapterSummaries` 控前多少章摘要；`chapterSummaryMode` 可选摘要或原文片段。
- `characterDetail: brief | standard | full` 决定角色卡字段的裁剪深度。
- 上下文预算 `ContextConfig.contextBudget` 默认 12000；`assembleContext()` 统计作品信息、分节标题与内容，不含系统提示、聊天历史、作者消息或任务额外材料。超限时先从低优先级分节逐条省略可精简资料，不足时丢弃该分节；仍超限再截断剩余内容。旧配置缺省时回退 `maxTokens`，最后回退 6000。
- Agent 不把抽屉预览直接作为完整输入，而是按需读取资料，并分别检查规划、写作和资料整理的材料；超限可直接报错。预算为 0 只关闭应用侧限制，模型窗口已知时仍检查完整请求，未知时无法硬性检查。输出上限为 0 通常由服务商决定，Anthropic 兜底 4096，并非无限。
- `aiVisible = false` 的角色/设定不能被读取，明确引用也不能绕过；`revealAtChapter` 大于当前章号或当前章未知时默认隐藏，本轮明确 `@` 引用可例外读取未揭示的卡。开启故事档案时默认只读取当前章之前的档案，明确引用可例外读取指定档案；关闭档案开关时不能读取。

### Provider 适配层

统一接口是「给一组 messages，返回一串 chunk」。差异全部收敛在 `lib/ai/provider.ts`：

- **URL 归一**：用户只填 baseUrl；OpenAI 兼容服务按是否已含 `/chat/completions`、是否以 `/v1` 结尾自动补全路径。
- **鉴权差异**：OpenAI 兼容用 `Authorization: Bearer`；Anthropic 用 `x-api-key` + `anthropic-version`；Gemini 用 query `key=`；Ollama 不需要 key。
- **事件差异**：OpenAI 的 `choices[0].delta.content`、推理模型额外的 `reasoning_content`；Anthropic 的 `content_block_delta` / `message_start` / `message_delta`；Gemini 的 `candidates[].content.parts[].text` 与 `usageMetadata`。
- **演示模式**：`kind: "demo"` 不联网，部分传统任务使用确定性模板；多步 Agent 要求实际可用的模型，演示模式不能完成 Agent 审阅流程。
- 错误统一成 `ProviderError`（带 `status`），引擎转成 `error` 事件并写日志；「测试连接」按钮走 `testProvider()`，20 秒超时。

### SSE 事件协议

| 事件 | 载荷 | 用途 |
| --- | --- | --- |
| `meta` | 运行 ID、模型名、供应商、功能 | 显示本次请求使用的模型 |
| `agent` | 持久化的 Agent 运行记录 | 展示步骤、引用、候选、状态与用量 |
| `agent-preview` | 运行 ID、文本增量 | 流式预览正在生成的正文 |
| `reasoning` | 文本增量 | 推理模型的思考过程，可折叠 |
| `delta` | 文本增量 | 正文/回答增量 |
| `action` | `AiAction` | 结构化产出（替换正文、保存档案、保存章纲…） |
| `done` | usage（prompt/completion token、耗时等）、可选消息 ID | 收尾；服务商返回 usage 时优先使用，否则使用本地估算 |
| `error` | code、message | 失败提示，保留已生成内容 |

## Diff 引擎

AI 改稿必须可审阅，核心是 `lib/diff/blocks.ts`：

1. **`splitBlocks(html)`**：把 Tiptap HTML 切成块（`p/h1-h6/blockquote/li/pre/hr/div`），块 ID 由「序号 + 内容哈希」组成，内容不变则 ID 稳定。
2. **`diffBlocks(before, after)`**：块级 LCS 对齐；相邻相同块之间的空隙按位置配对为 `changed`，多出来的旧块是 `removed`、新块是 `added`；每个变化的块附带 `anchorId` 指向前一个未变块。
3. **`diffInline(before, after)`**：块内先裁公共前后缀，再对中段做字符级 LCS，输出 `same / add / del` 片段；长度乘积过大时退化为「整段删 + 整段加」，保证 1 万字以内不卡。
4. **`applyBlockDiff(before, diff, acceptedIds)`**：只把用户勾选的块应用回原文；`added` 块挂到锚点之后，最后一个锚点为 `null` 时插到开头。

行级 diff（`diffLines` / `diffTextLines`）用于导入预览、版本对比等纯文本场景。测试见 `tests/blocks.test.ts`。

## 设计决策与取舍

| 决策 | 取舍 |
| --- | --- |
| **SQLite 单文件，而非 Postgres/Mongo** | 换来零安装、可备份、可移植；放弃多用户并发与水平扩展（本项目定位就是单机单人）。 |
| **`node:sqlite` 内置驱动，而非 better-sqlite3** | 换来零原生依赖、Docker 镜像不装编译工具链；代价是 API 仍在 experimental、跟随 Node 版本升级。 |
| **同步 DB 访问** | 代码简单、无连接池；长查询会阻塞事件循环，因此列表接口全部限制分页、正文按章读取。 |
| **正文存 Tiptap HTML，而非 Markdown/AST** | 编辑器是唯一事实源，diff/导出从 HTML 派生；代价是导入 TXT 需要拆章与段落包装。 |
| **AI 输出强制走 diff / 显式动作** | 用户永远保留最终决定权，避免「AI 偷偷改稿」；代价是交互多一步确认。 |
| **上下文装配器可预览** | 让「AI 为什么这么写」可解释、成本可估算；代价是要为每个维度维护格式化逻辑。 |
| **五类 Provider 自研适配，而非接 LangChain 类框架** | 只依赖 `fetch`，请求/响应完全透明，方便加自定义字段；代价是新供应商要自己写适配（教程见 CONTRIBUTING）。 |
| **SSE 而非 WebSocket** | 单向流式足够，HTTP 语义简单、反代友好；放弃双向实时协作。 |
| **无账号、无遥测** | 隐私与部署成本最优；放弃云同步、用量统计、灰度发布能力。 |
| **Tailwind v4 + CSS 变量 token** | 双主题与品牌一致性成本最低；代价是设计规范必须靠 review 维持（禁止硬编码颜色）。 |

## 已知限制

- 单用户单进程：不要在同一份数据库上同时跑两个写入进程。
- 长上下文与超大章节会撞到模型上限；装配器会裁剪，但不保证模型不丢细节。
- 推理模型的 `reasoning` 内容依供应商而定，部分服务不返回。
- 故事档案由模型生成，可能含幻觉；`status` 会标记过期/待确认，需要人工核对。
- `node:sqlite` 在 Node 22 上仍标记 experimental，升级 Node 主版本时请跑一遍 `pnpm test` 并启动一次应用（触发 schema 与种子检查）。
