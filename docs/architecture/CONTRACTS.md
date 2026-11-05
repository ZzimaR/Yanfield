# 砚田 Yanfield — 共建契约（v0.1.0 · 开发中）

> 贡献者改动共享模块、接口或数据结构前请先读本文。改动本文约定的接口时，请在同一个 PR 里同步更新本文。
> 最后更新：2026-11-01。当前版本是开发中的 v0.1.0；§8 是这一版里已经落地的契约补充。路线图里的 v0.2 仍是未开始的计划。

## 0. 一句话

源码公开、本地优先、可接入任意 OpenAI 兼容 API 的中文网文创作工作台：作品/卷/章三级结构 + 三级大纲 + 资料卡（角色/设定/伏笔）+ 故事档案 + 多智能体对话 + 逐块 diff 改稿。目标：功能对标马良写作，UI 更顺手，5 分钟跑起来。

## 1. 技术栈与命令

- Next.js 15 App Router + React 19 + TypeScript strict + Tailwind v4 + Tiptap 3 + `node:sqlite`（Node ≥ 22.13 内置，无需实验标志，零原生依赖）
- 数据文件：系统用户数据目录下的 `yanfield.db`（自动创建；可用 `YANFIELD_DB_PATH` 覆盖，见 [deploy.md](../deploy.md#数据位置)）
- 包管理：pnpm（Node ≥ 22.13）
- 开发服务器：`pnpm dev`（端口 3000）
- 自检：`pnpm exec tsc --noEmit`、`pnpm test`；改动构建相关配置时再跑 `pnpm build`

## 2. 模块分区

| 范围 | 分区 | 说明 |
|---|---|---|
| `lib/types.ts` `lib/repo.ts` `lib/db/index.ts` `lib/seed.ts` `lib/defaults.ts` `lib/client/*` `lib/ui/*` `lib/ai/*` `lib/diff/*` `lib/editor/bridge.tsx` `components/ui/*` `components/layout/*` `app/layout.tsx` `app/globals.css` `app/api/ai/**` `types/**` `docs/architecture/*` | **core** | 领域模型、数据访问、AI 引擎、设计系统、AI 路由 |
| `app/api/**`（除 `app/api/ai/**`）`app/api/_lib/**` | **api-routes** | 全部 REST Route Handler：作品/卷/章/大纲/角色/世界观/伏笔/档案/对话/Provider/预设/设置/统计/搜索/导入导出/demo |
| `app/editor/[novelId]/**` `components/editor/**` `lib/editor/**`（除 `bridge.tsx`） | **editor** | 三栏工作台 + 目录树 + Tiptap + 自动保存 + diff 审阅槽位 |
| `components/ai/**` `components/diff/**` | **ai-assistant** | AI 面板、上下文抽屉、流式渲染、逐块 diff 审阅组件 |
| `app/novel/[novelId]/{outline,bible,archives}/**`（307 重定向到写作台）`components/cards/**` `components/outline/**` `components/archives/**` | **knowledge** | 旧大纲/设定/档案页仅保留重定向；内容在写作台左栏「章纲 / 设定 / 档案」页签就地编辑 |
| `app/page.tsx` `app/library/**` `app/settings/**` `app/novel/[novelId]/page.tsx` `app/not-found.tsx` `app/error.tsx` `app/loading.tsx` `components/landing/**` `components/library/**` `components/settings/**` | **shell** | 落地页、书架、设置、作品概览 |
| `README.md` `LICENSE` `CONTRIBUTING.md` `docs/**`（除 architecture） `tests/**` `vitest.config.ts` `Dockerfile` `.dockerignore` `.github/**` `scripts/**` `public/**` | **docs** | 文档、测试、截图脚本、部署、许可证 |

core 分区是其他模块依赖的共享层，改动其中的类型、接口或样式 token 时，请检查所有调用方并同步更新本文。

## 3. 共享模块 API（已实现，直接用）

### `lib/types.ts`（领域类型，只读）
`Novel` `Volume` `Chapter` `NovelOutline` `VolumeOutline` `ChapterBlueprint` `ScenePlan` `Character` `WorldSetting` `Foreshadow` `StoryArchive` `ChatSession` `ChatMessage` `AiAction` `AiStreamEvent` `ContextConfig` `ProviderConfig` `ModelSetting` `PromptPreset` `AiLog` `AppSettings` `DashboardStats`；
常量 `AGENTS`（9 个预设智能体）、`CUSTOM_AGENT`、`DEFAULT_CONTEXT_CONFIG`、`DEFAULT_APP_SETTINGS`、`AI_FEATURE_LABEL`、`NOVEL_STATUS_LABEL`、`CHAPTER_STATUS_LABEL`、`CHARACTER_ROLE_LABEL`、`WORLD_CATEGORY_LABEL`、`FORESHADOW_STATUS_LABEL`、`ARCHIVE_STATUS_LABEL`、`GENRES`、`COVER_KEYS`、`COVER_STYLES`。

### `lib/repo.ts`（服务端数据访问，所有 Route Handler 使用）
```ts
// 作品
listNovels(): Novel[]
getNovel(id): Novel | undefined
createNovel(input: Partial<Novel> & { title: string }): Novel
updateNovel(id, patch: Partial<Novel>): Novel
deleteNovel(id): void
touchNovel(id): void                       // 更新 lastOpenedAt
getNovelTree(novelId): { novel, volumes: (Volume & { chapters: Chapter[] })[], looseChapters: Chapter[] } | undefined

// 卷 / 章
listVolumes(novelId), createVolume(novelId, { title, summary? }), updateVolume(id, patch), deleteVolume(id)
listChapters(novelId), getChapter(id), getChaptersByIds(ids), createChapter(novelId, { title, volumeId?, orderIndex?, content? }),
updateChapter(id, patch): Chapter, deleteChapter(id), moveChapter(id, { volumeId, orderIndex })

// 大纲
getNovelOutline(novelId): NovelOutline            // 不存在时自动建空记录
saveNovelOutline(novelId, patch): NovelOutline
getVolumeOutline(volumeId): VolumeOutline
saveVolumeOutline(volumeId, patch): VolumeOutline
getBlueprint(chapterId): ChapterBlueprint          // 不存在时自动建空记录
saveBlueprint(chapterId, patch): ChapterBlueprint

// 资料卡
listCharacters(novelId), getCharacter(id), createCharacter(novelId, input), updateCharacter(id, patch), deleteCharacter(id), reorderCharacters(ids)
listWorld(novelId), getWorld(id), createWorld(novelId, input), updateWorld(id, patch), deleteWorld(id)
listForeshadows(novelId), createForeshadow(novelId, input), updateForeshadow(id, patch), deleteForeshadow(id)

// 故事档案
listArchives(novelId), getArchiveByChapter(chapterId), upsertArchive(input: Partial<StoryArchive> & { novelId; chapterId }): StoryArchive, deleteArchive(id), markArchivesStaleAfter(novelId, orderIndex)

// 对话
listChatSessions(novelId), getChatSession(id), createChatSession(novelId, { agentId?, chapterId?, title? }), updateChatSession(id, patch), deleteChatSession(id)
listMessages(sessionId), addMessage(sessionId, input), updateMessage(id, patch), deleteMessage(id)

// 模型 / 预设 / 设置 / 统计 / 日志 / 搜索
listProviders(), getProvider(id), createProvider(input), updateProvider(id, patch), deleteProvider(id)
listPresets(novelId?): PromptPreset[], upsertPreset(input), deletePreset(id), ensureBuiltinPresets()
getSettings(): AppSettings, saveSettings(patch: Partial<AppSettings>): AppSettings
getStats(): DashboardStats
addAiLog(input), listAiLogs(limit?)
search(q: string): SearchResult[]
```
所有函数同步执行（sqlite 同步 API），返回值已是 camelCase 领域对象。

### `lib/client/api.ts`（客户端）
```ts
apiGet<T>(url): Promise<T>
apiSend<T>(url, method, body): Promise<T>
useApi<T>(url: string | null, deps?: unknown[]): { data: T | undefined; error: string | null; loading: boolean; refresh: () => void; setData: (v: T | undefined) => void }
// SSE（已实现，按事件回调）
streamAiChat(body: AiChatRequest, handlers: { onEvent: (e: AiStreamEvent) => void; signal?: AbortSignal }): Promise<void>
streamAiTask(body: AiTaskRequest, handlers: { onEvent: (e: AiStreamEvent) => void; signal?: AbortSignal }): Promise<void>
// 数据变更广播
notifyDataChanged(topic?: string) / useDataChanged(handler, topics?)
```

### `lib/ui/cn.ts`
`cn(...cls)`、`countWords(htmlOrText)`、`formatWords(n)`、`formatNumber(n)`、`formatRelativeTime(iso)`、`formatDateTime(iso)`、`truncate(s,n)`、`uid(prefix?)`、`sleep(ms)`、`clamp(n,min,max)`、`stripHtml(html)`、`diffLines(a,b)`、`estimateTokens(text)`（`diffTextLines` 在 `lib/diff/blocks.ts`）。

### `lib/diff/blocks.ts`（已实现，以此为准）
```ts
type Block = { id: string; html: string; text: string };
type InlineDiff = { type: "same" | "add" | "del"; text: string };
type BlockChange = {
  id: string;                              // = 块变更 id，接受/拒绝时回传
  type: "added" | "removed" | "changed";
  before?: string; after?: string;         // HTML
  beforeText?: string; afterText?: string; // 纯文本（展示用）
  inline?: InlineDiff[];                   // changed 时的行内 diff
  anchorId: string | null;                 // 相邻未变更块 id，便于插入定位
};
type BlockDiff = { items: BlockChange[]; added: number; removed: number; changed: number };

splitBlocks(html: string): Block[]
diffInline(before: string, after: string): InlineDiff[]
diffBlocks(beforeHtml: string, afterHtml: string): BlockDiff
applyBlockDiff(beforeHtml: string, diff: BlockDiff, acceptedIds: string[]): string  // 只应用 acceptedIds 内的变更
diffTextLines(before: string, after: string): { type: "same" | "add" | "del"; text: string }[]
```

### `lib/editor/bridge.tsx`（core 定义接口，编辑器负责注入实现）
```tsx
export interface EditorBridge {
  getHtml(): string;
  getSelectionText(): string;
  insertText(text: string): void;          // 在光标处插入（续写用）
  replaceSelection(text: string): void;
  appendText(text: string): void;
  focus(): void;
}
export function EditorBridgeProvider(props: { children: React.ReactNode; value: EditorBridge | null }): JSX.Element
export function useEditorBridge(): EditorBridge | null
```
AI 面板通过 `useEditorBridge()` 把 AI 文本插入正文；没有选中也没光标时，面板要禁用「插入」并提示。

### `components/ui/*`（UI kit，页面不要覆写其内部样式）
```tsx
Button({ variant: "primary"|"secondary"|"ghost"|"danger"|"subtle", size: "sm"|"md"|"lg"|"icon", loading?, icon?: ReactNode })
IconButton({ label: string, active?, size?: "sm"|"md", children })
Input / Textarea / Select / Switch / Slider  （均带 label?, hint?, error?）
Card({ padded?, hover?, className? })
Badge({ tone: "default"|"accent"|"jade"|"gold"|"danger", children })
Dialog({ open, onClose, title?, description?, footer?, width?, children })
ConfirmDialog({ open, title, description?, confirmText?, danger?, onConfirm, onClose })
Tabs({ tabs: { value, label, icon? }[], value, onChange })
Dropdown({ trigger, items: ({ label, icon?, danger?, disabled?, onSelect } | { separator: true })[], align? })
Tooltip({ label, children, side? })
EmptyState({ icon?, title, description?, action? })
Spinner({ size? }) / Skeleton({ className? })
useToast(): { toast: (msg: { title, description?, tone?: "default"|"success"|"error" }) => void }
Markdown({ text, className? })   // 安全轻量 markdown 渲染（AI 消息用）
```
样式只允许用设计 token 类名（`bg-paper` `bg-surface` `bg-surface-2` `text-ink` `text-ink-2` `text-ink-3` `text-ink-4` `border-line` `border-line-strong` `text-accent` `bg-accent-soft` `text-jade` `text-gold` `shadow-xs` `shadow-card` `shadow-float` `rounded-md` `rounded-lg` 等），禁止硬编码 hex。

### `components/layout/AppShell.tsx`
```tsx
<AppShell novelId? active="library"|"overview"|"outline"|"bible"|"archives"|"editor"|"settings">
  {children}
</AppShell>
```
含左侧极简导航（书架/作品/设置）、作品内二级导航（概览/大纲/设定/档案/写作）、右上主题切换。页面直接套用。

### `lib/ui/hooks.ts`
`useDebouncedValue(v, ms)`、`useLocalStorageState(key, initial)`、`useMediaQuery(q)`、`useOnClickOutside(ref, cb)`、`useHotkeys(map)`、`useResizePanel(...)`（三栏拖宽用，editor 可直接用）。

## 4. REST API 契约（Route Handlers；全部 runtime=nodejs）

响应统一：成功 `200/201` 返回 JSON（列表 `{ items: T[] }` 或对象本身）；失败 `{ error: string }` + 4xx/5xx。

| 方法/路径 | 说明 |
|---|---|
| `GET /api/novels` | `{ items: Novel[] }` |
| `POST /api/novels` | body `{ title, genre?, synopsis?, ... }` → Novel |
| `GET/PATCH/DELETE /api/novels/[id]` | 作品详/改/删（删含级联） |
| `GET /api/novels/[id]/tree` | `{ novel, volumes: [...chapters], looseChapters }` |
| `POST /api/demo` | 新增示例作品（含 2 卷 5 章 + 资料卡 + 大纲），返回 Novel |
| `GET/POST /api/volumes` | query `novelId`；POST body `{ novelId, title }` |
| `PATCH/DELETE /api/volumes/[id]` | |
| `GET/POST /api/chapters` | query `novelId`；POST `{ novelId, volumeId?, title }` |
| `GET/PATCH/DELETE /api/chapters/[id]` | PATCH 用于自动保存（`content`,`title`,`summary`,`status`,`notes`） |
| `POST /api/chapters/[id]/move` | `{ volumeId, orderIndex }` |
| `GET/PATCH /api/chapters/[id]/blueprint` | 章纲 |
| `GET/PATCH /api/outlines/novel/[novelId]` | 总纲 |
| `GET/PATCH /api/outlines/volume/[volumeId]` | 卷纲 |
| `GET/POST /api/characters` `/api/world` `/api/foreshadows` | query `novelId` |
| `PATCH/DELETE /api/{characters,world,foreshadows}/[id]` | |
| `GET /api/archives?novelId=&chapterId=` | 列表或单章 |
| `POST /api/archives` | upsert（body 同 StoryArchive 字段） |
| `DELETE /api/archives/[id]` | |
| `POST /api/ai/chat` | 传统对话 SSE：body `{ novelId, message, chapterId?, sessionId?, agentId?, mode?, context?, selection?, presetId?, mentions? }`；事件为 `data: {json}\n\n` |
| `POST /api/ai/task` | 传统单点任务 SSE：body `{ feature, novelId, chapterId?, message?, selection?, context?, presetId?, targetWords?, instruction? }`；返回 `meta`、`delta`、可选 `action` 及 `done`/`error` |
| `GET/POST /api/ai/agent` | GET 按作品列出运行记录；POST 接收消息、章节、引用、选区及上下文配置，返回 Agent SSE |
| `GET/PATCH /api/ai/agent/[id]` | GET 按作品读取持久化运行记录与候选；PATCH 可丢弃待确认候选 |
| `POST /api/ai/agent/[id]/apply` | 选择候选、字段或正文块并事务应用；`op: "undo"` 校验后撤回 |
| `POST /api/ai/context` | body `{ novelId, chapterId?, context?: Partial<ContextConfig>, selection?, mentions? }` → `AssembledContext`：`{ text, sections: { id, label, text, tokens, included, truncated, priority }[], tokens, budget, chapterIndex, dropped }`（上下文预览抽屉用，见 §8.1） |
| `POST /api/ai/archives/extract` | `{ novelId, chapterId }` → SSE；按当前默认模型提取并保存档案，返回 `save-archive` 动作，失败时返回错误事件 |
| `GET/POST /api/chat/sessions` | query `novelId=`；POST `{ novelId, agentId?, chapterId?, title? }` |
| `PATCH/DELETE /api/chat/sessions/[id]` | |
| `GET/POST /api/chat/sessions/[id]/messages` | 取历史 / 追加消息（流式结束后写库） |
| `GET/POST /api/providers` | API Key 在 GET 时做掩码（`sk-****abcd`），PATCH 传空串表示不修改 |
| `GET/POST /api/presets` | 提示词预设，`?novelId=` 兼容全局 |
| `GET/PATCH /api/settings` | AppSettings（单例） |
| `GET /api/stats` | DashboardStats |
| `GET /api/search?q=` | `{ items: SearchResult[] }` |
| `POST /api/import/txt` | `multipart/form-data: file`+`regex?` → `{ chapters: { title, content }[] }`（仅解析预览） |
| `POST /api/import/apply` | `{ novelId, chapters, volumeTitle? }` |
| `GET /api/export/[novelId]` | 文件下载；`format` 可选 `md`、`txt`，`scope` 可选 `chapter`、`volume`、`book`，可附带 `id` |

## 5. 数据与约定

- ID：`uid("nov")`（nanoid 风格短 id，见 `lib/ui/cn.ts`）；时间：ISO 字符串。
- 正文存储为 **Tiptap HTML**（`<p>...</p>`），空章 `""`；字数用 `countWords(html)` 计算后写入 `wordCount`。
- 自动保存：停止输入 `settings.autoSaveDelayMs`（默认 1200ms）后 `PATCH /api/chapters/[id]`；`Ctrl/Cmd+S` 立即保存；保存状态显示「保存中/已保存 hh:mm」。
- AI 一切正文产出必须走 diff 或显式「插入」，禁止静默覆盖正文。
- 上下文预算 `contextBudget`（默认 12000，`0` 关闭应用侧限制）与单次输出上限 `maxTokens`（默认 0 = 自动）是两个概念，详见 §8.1；`/api/ai/context` 返回作品资料装配预览，不是 Agent 实际请求的逐字清单。模型窗口已知时完整请求仍会检查，未知时无法硬性检查。
- 禁止在代码里写死 API Key；provider 配置落本地 DB，README 注明「本地明文存储，仅限个人机器」。
- 所有 AI 请求写 `ai_logs`（token/延迟/状态），统计页用。

## 6. 设计系统（必须遵守）

- 主题：宣纸（浅）/夜航（深），强调色为浅蓝。`<html data-theme="light|dark">`，token 定义见 `app/globals.css`。
- 字体：正文 `font-serif`（Noto Serif SC 栈），UI `font-sans`；正文行高 1.95、段首 2em（`.prose-paper`）。
- 间距：8px 网格；圆角 `rounded-md(10px)` / `rounded-lg(14px)`；边框 1px `border-line`；阴影 `shadow-xs` / `shadow-card` / `shadow-float`。
- 动效：150–250ms ease-out，遵循 `prefers-reduced-motion`。
- 空状态必须有：一句说明 + 一个主操作（用 `EmptyState`）。
- 中文文案，克制、具体；按钮动作用动词开头；AI 相关必须显示所用模型名。

## 7. 协作规则

完整流程见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。与本文相关的几条：

1. 改动共享模块（core 分区）的类型或接口时，检查所有调用方，并在同一个 PR 里更新本文。
2. 提交前确认 `pnpm exec tsc --noEmit` 与 `pnpm test` 通过；页面改动请实际打开页面点一遍主要交互。
3. 新增依赖请在 PR 里说明理由。
4. 数据库结构只通过 `lib/db/index.ts` 的 `MIGRATIONS` 追加迁移来修改，不改已有迁移（见 [architecture.md](../architecture.md)）。

## 8. 当前版本（v0.1.0）已落地的契约补充

> 下面这些能力属于正在开发的 v0.1.0，不是下一个版本。实现以源码为准。

### 8.1 上下文预算 `ContextConfig.contextBudget`

当前开发版（0.1.0）早期把 `maxTokens` 当作「上下文预算」使用；现在拆成两个概念：

```ts
interface ContextConfig {
  // …原有各 include* 开关、customInstruction 等字段不变

  /** 上下文预算（token）：统计完整作品上下文文本（作品信息、分节标题与内容）；不含系统提示/聊天历史/任务正文 */
  contextBudget: number;   // 默认 12000（DEFAULT_CONTEXT_CONFIG.contextBudget）
  /** 单次输出上限（token）：只限制模型这次回答的长度 */
  maxTokens: number;       // 默认 0 = 自动，通常用服务商默认值
}
```

- **取值优先级**（`lib/ai/context.ts`）：`contextBudget > 0` 用它；`contextBudget === 0` 表示不限；未给或非法值时回退旧的 `maxTokens`（若 >0），再回退装配器兜底常量 `DEFAULT_CONTEXT_BUDGET = 6000`。默认配置下实际预算 **12000**。
- **超预算行为**：先按 `priority < 90` 从低到高处理分节。档案与前情先逐条省略较早记录；角色、设定和伏笔先省略排序靠后的条目（相关性按名称、别名等文本匹配估算，并非语义检索）。仍超时丢弃该分节并记入 `dropped`。低优先级分节处理后仍超预算，就从低优先级开始截断剩余内容，必要时也会截断或移除高优先级块。`tokens` 是完整装配文本（含分节标题）的估算量；UI 的上下文抽屉展示 `sections[].tokens / included / truncated` 与 `budget`。系统提示、聊天历史、作者消息与任务正文不计入此预算。
- **Agent**：不直接把预览当作完整输入；规划、写作和资料整理分别检查任务材料，超限可直接报错。完整请求检查包含系统消息、历史、工具定义及输出预留；模型窗口元数据未知时无法执行该检查。
- **输出上限**：普通请求和 Agent 将配置用于 Provider；0 通常使用服务商默认值，Anthropic 兜底 4096，并非无限。档案提取有独立的输出预算与重试策略，部分推理模型会省略不兼容参数。
- **建议**：为系统提示、历史、任务与输出预留空间；模型或本地 Ollama 的窗口容量应以当前服务和配置为准，未返回容量时界面显示未知。

### 8.2 `ModelOption.contextWindow`

```ts
interface ModelOption {
  id: string;
  label: string;
  /** 模型上下文窗口（token），用于 UI 提示及完整请求检查；未知时省略 */
  contextWindow?: number;
}
```

品牌预设不内置模型或窗口容量；主动拉取时若服务商返回窗口元数据会保存并显示，否则保持未知，不根据旧推荐值猜测。完整请求检查仅在已知窗口时执行，使用近似 token 估算，并为输出预留空间。

### 8.3 服务商预设 `ProviderPreset` / `PROVIDER_PRESETS` / `getProviderPreset`

```ts
export interface ProviderPreset {
  key: string;              // 稳定 id，用于 getProviderPreset / env 绑定
  name: string;             // 展示名，也是 env 自动建 Provider 时的去重键
  description: string;      // 设置页一句话说明
  kind: ProviderKind;       // 协议：openai | anthropic | gemini | ollama | demo（仍只有 5 种）
  baseUrl: string;          // 已填好的默认 Base URL（custom 为空串）
  keyUrl?: string;          // 申请 Key 的控制台
  envKeys: string[];        // 服务启动时自动建 Provider 用的环境变量（按顺序取第一个非空）
  models: ModelOption[];    // 品牌预设为空；模型由用户拉取或填写
  note?: string;            // 额外提示（custom / ollama 用）
}

export const PROVIDER_PRESETS: ProviderPreset[];              // 11 项，见下表
export const ENV_PROVIDER_BINDINGS: { preset: string; envKeys: string[] }[]; // 除 custom 外的映射
export function getProviderPreset(key: string): ProviderPreset | undefined;
```

| key | 名称 | kind | 默认 baseUrl | envKeys |
|---|---|---|---|---|
| `openai` | OpenAI | openai | `https://api.openai.com/v1` | `OPENAI_API_KEY` `YANFIELD_OPENAI_API_KEY` |
| `deepseek` | DeepSeek | openai | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` |
| `dashscope` | 通义千问 | openai | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` `QWEN_API_KEY` |
| `moonshot` | Moonshot / Kimi | openai | `https://api.moonshot.cn/v1` | `MOONSHOT_API_KEY` `KIMI_API_KEY` |
| `zhipu` | 智谱 GLM | openai | `https://open.bigmodel.cn/api/paas/v4` | `ZHIPU_API_KEY` `GLM_API_KEY` `BIGMODEL_API_KEY` |
| `anthropic` | Anthropic Claude | anthropic | `https://api.anthropic.com` | `ANTHROPIC_API_KEY` |
| `gemini` | Google Gemini | gemini | `https://generativelanguage.googleapis.com` | `GEMINI_API_KEY` `GOOGLE_API_KEY` |
| `openrouter` | OpenRouter | openai | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` |
| `siliconflow` | 硅基流动 | openai | `https://api.siliconflow.cn/v1` | `SILICONFLOW_API_KEY` |
| `ollama` | Ollama（本地） | ollama | `http://127.0.0.1:11434/v1` | `OLLAMA_BASE_URL` `YANFIELD_OLLAMA_BASE_URL` |
| `custom` | 自定义（OpenAI 兼容） | openai | （空串，用户填） | — |

- 设置页直接消费预设：**选品牌 → 填写 Key → 主动拉取或手动添加模型 → 保存并选择默认模型**。新增品牌通常只需往 `PROVIDER_PRESETS` 加数据。
- `getProviderPreset(key)` 找不到时返回 `undefined`，调用方（设置页、seed）必须兜底（设置页退回自定义表单）。
- 预设只是**配置模板**，`ProviderConfig` 落库后仍可手改 baseUrl 与模型 id，所以任何 OpenAI 兼容服务都能接。

### 8.4 环境变量自动创建 Provider：`lib/seed.ts` 的 `ensureEnvProviders()`

- **时机**：`ensureReady()` 内，顺序为 内置预设 → 默认设置 → 演示 Provider → `ensureEnvProviders()` → 无作品时写示例作品。幂等，每进程只做一次；服务端专用，**不要在客户端调用**。
- **顺序**：`deepseek → openai → dashscope → moonshot → zhipu → anthropic → gemini → openrouter → siliconflow`；每个品牌按 `envKeys` 顺序取第一个非空值。
- **跳过规则**：已存在**同名** Provider（`provider.name === preset.name`）跳过，所以手工配置过的不会被覆盖；Ollama 额外按 `kind === "ollama"` 判重；自定义兼容按 `baseUrl` 判重。
- **特殊变量**：
  - `YANFIELD_OPENAI_COMPAT_BASE_URL` + `YANFIELD_OPENAI_COMPAT_API_KEY` + `YANFIELD_OPENAI_COMPAT_MODEL` → 创建「自定义（OpenAI 兼容）」；`_MODEL` 为空时默认 `gpt-4o-mini`（需用户改成实际模型）。
  - `OLLAMA_BASE_URL` / `YANFIELD_OLLAMA_BASE_URL` → 创建 kind `ollama` 的 Provider，免 Key。
- **默认模型切换**：仅当本次新建了 Provider、且当前 `settings.models.chat.providerId` 为空或指向 demo 时，才把 chat / prose 切到第一个新建服务及其第一个模型；品牌服务的模型列表为空时模型 ID 也为空，须由用户拉取并选择。已有真实默认模型时不动；实际调用统一读取 `settings.models.chat`，界面选择会同时更新两个字段。
- **返回值**：`ProviderConfig[]`（本次新建的列表，可能为空）。启动日志与测试（`tests/seed-env.test.ts`）依赖这一语义。

### 8.5 Provider 错误、超时与推理模型参数（`lib/ai/provider.ts`）

- **错误类型**：`ProviderError extends Error`（`status` 默认 500）。路由层捕获后把中文 `message` 写进 SSE `error` 事件或 JSON `{ error }`；对作者只暴露中文文案，不泄露 Key。
- **中文文案**（`friendlyHttpMessage`，均带服务商名，原始错误截断 180 字）：401/403 → 鉴权失败、Key 无效/过期/无模型权限；404 → Base URL 或模型 id 不对；429 → 限流或额度不足；≥500 → 服务端暂不可用；其他 → `请求失败（HTTP n）`。
- **超时**：统一 `DEFAULT_TIMEOUT_MS = 180000`（3 分钟，长篇续写可能较慢），用 `AbortSignal.timeout` 与调用方 signal 经 `AbortSignal.any` 合并，调用方取消优先。`testProvider` 单独 **20 秒**超时、`maxTokens = 8`；未配置模型 / 未填 Key 直接返回中文提示；aborted 归一为「连接超时（20 秒）」。
- **推理模型参数省略**：`isReasoningModel(model)` 匹配 `/^(o1|o3|o4|gpt-5|deepseek-reasoner|deepseek-r1)/i`，命中时**省略** `temperature` 与 `max_tokens`（否则部分服务商直接 400）。非推理模型默认 `temperature = 0.8`；`max_tokens` / `maxOutputTokens` 仅 `> 0` 时传。
- **流式映射**：OpenAI 的 `reasoning_content` / `reasoning`、Anthropic 的 `thinking_delta`、Gemini 的 `thought` 统一映射为 `reasoning` chunk（只展示为「思考过程」，**不写入正文**）；`usage` chunk 用于写 `ai_logs`。

### 8.6 兼容性说明

- 旧客户端若仍只传 `maxTokens` 作为预算，装配器会回退兼容（见 8.1），不会报错；新代码应改用 `contextBudget`。
- `/api/ai/context` 的响应结构已在 §4 更新为 `AssembledContext`，字段名是 `id`/`text`（旧文档里的 `key`/`content`/`mode` 已废弃）。
- `tests/providers.test.ts`（协议解析：OpenAI 兼容 / Anthropic / Gemini SSE、401 中文错误、未填 Key）、`tests/provider-models.test.ts`（/models 拉取模型列表：四类协议、去重、401 中文错误）与 `tests/seed-env.test.ts`（环境变量建 Provider、demo 兜底、默认预算）是这两块的回归测试，改 Provider/seed 时必须保持通过。
