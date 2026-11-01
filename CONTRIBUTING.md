# 贡献指南

感谢你愿意参与砚田！这是一个**作者写给作者**的工具，欢迎三种贡献：

- **代码**：功能、修复、性能、测试。
- **文档**：架构说明、Provider 样例、FAQ、中文文案打磨。
- **反馈**：真实写作中遇到的坑（上下文裁剪是否合理、diff 粒度是否好用），往往比代码更值钱。

参与前请先读 [行为准则](./docs/code-of-conduct.md)。不确定的事先开 Issue 聊，避免写完 PR 才发现方向不对。

---

## 1. 搭开发环境

### 依赖

| 项 | 要求 |
| --- | --- |
| Node.js | **≥ 22.13**（`node:sqlite` 在 22.13 起不需要实验标志；推荐 24 LTS） |
| pnpm | ≥ 9（不要用 npm/yarn，锁文件是 `pnpm-lock.yaml`） |
| 浏览器 | Chrome / Edge / Firefox / Safari 最新两个大版本 |

### 步骤

```bash
git clone <你的 fork 地址> yanfield
cd yanfield
pnpm install
pnpm dev        # http://127.0.0.1:3000
```

```powershell
# Windows PowerShell
git clone <你的 fork 地址> yanfield
Set-Location yanfield
pnpm install
pnpm dev
```

首次启动会自动创建 `data/yanfield.db` 并写入示例作品《潮信》与离线演示模型。

> **想接真实模型**：`cp .env.example .env`，填上某个 `*_API_KEY` 后重启，首次初始化会按内置预设自动创建 Provider（也可以什么都不填，直接在「设置 → 模型服务」里加）。部署相关（Docker / Compose / systemd / 反向代理 / 备份）见 [docs/deploy.md](./docs/deploy.md)。`.env` 已在 `.gitignore` 中，不要提交。两种「重来」方式，按需要选：

**A. 只重置示例数据（保留你自己的作品、Provider 与设置）**

```bash
pnpm db:seed    # 删除示例作品《潮信》与内置提示词预设，不会清空数据库
pnpm dev        # 重启后由 lib/seed.ts 的 ensureReady() 自动重建
```

**B. 彻底清空（连你的作品与密钥一起删掉，慎用）**

先 `Ctrl+C` 停掉 dev server，再删掉数据目录：

```bash
rm -rf data            # macOS / Linux
```

```powershell
Remove-Item -Recurse -Force data   # Windows PowerShell
```

重新 `pnpm dev` 即可得到全新数据库与示例数据。

### 改完后必须自检

```bash
pnpm typecheck   # tsc --noEmit，strict
pnpm test        # Vitest 单测
```

改到 UI 或路由时，再跑一次 `pnpm build`，确认生产构建也没有类型/渲染问题（注意：构建不要依赖外网，模型请求只在运行时发生）。

### 常用调试入口

| 想调什么 | 去哪里 |
| --- | --- |
| 数据库表结构 | `lib/db/index.ts` 的 `SCHEMA` |
| 种子数据/示例小说 | `lib/seed.ts`、`lib/defaults.ts`；重置脚本 `scripts/seed.mjs`（`pnpm db:seed`） |
| 上下文装配 | `lib/ai/context.ts` 的 `assembleContext()` |
| 提示词模板 | `lib/defaults.ts` 的 `BUILTIN_PRESETS`、`lib/ai/prompts.ts` |
| Provider 适配 | `lib/ai/provider.ts` |
| SSE 事件 | `app/api/ai/sse.ts`、`lib/ai/engine.ts` |
| Diff 行为 | `lib/diff/blocks.ts` + `tests/blocks.test.ts` |
| 设计 token | `app/globals.css` |
| 组件库 | `components/ui/kit.tsx` |

---

## 2. 代码规范

### TypeScript

- 全仓库 `strict`，**禁止 `any`**。外部数据（请求体、模型返回）用 `unknown` 接住，再用 zod 或手写类型守卫收窄；`lib/ai/provider.ts` 里的 `asRecord`/`get`/`pickString` 就是范本。
- 领域类型统一放 `lib/types.ts`，不要在各处重复定义同义结构。
- 导出优先用具名导出（`export function foo`），不要用 `export default`（Next.js 页面/路由的约定导出除外）。
- 服务端代码（`app/api/**`、`lib/repo.ts`、`lib/db/**`）不得被客户端组件直接 import；浏览器只能通过 `lib/client/api.ts` 访问 `/api/*`。
- 错误用 `ApiError`（`lib/api-utils.ts`）或 `ProviderError`（`lib/ai/provider.ts`）表达，带上合适的 HTTP 状态码与中文提示。

### 样式与组件

- 只用设计 token：`bg-paper`、`text-ink-2`、`border-line`、`text-accent`、`rounded-md`、`shadow-card` 等；**禁止硬编码十六进制颜色**（`public/` 里的静态 SVG 与 `og.svg` 除外，它们无法读 CSS 变量）。
- 双主题必须同时在「宣纸」「夜航」下目测；新增颜色请先在 `app/globals.css` 的 `:root` 与 `[data-theme="dark"]` 里各加一个变量，再在 `@theme inline` 里映射。
- 交互组件优先复用 `components/ui/kit.tsx`（Button/Dialog/Tabs/Dropdown/EmptyState/Toast…），不要另起一套。
- 空状态必须写清「这里是什么 + 主操作是什么」；按钮文案动词开头、中文克制具体。
- 动效 150–250ms `ease-out`，尊重 `prefers-reduced-motion`。

### 注释

- **用中文写注释**，解释「为什么」而不是复述代码。
- 公共函数写 JSDoc：一句话职责 + 参数/返回值要点；复杂算法（diff、上下文裁剪、SSE 状态机）在关键分支写行内注释。
- 不要留 `TODO` 孤岛：写成 `// TODO(昵称): 原因 + 期望做法`，或在 Issue 里登记。

### 依赖与数据

- **不要随意新增依赖**：优先用 Node/浏览器内置能力（`fetch`、`node:sqlite`、`Intl`）。确有需要，先在 Issue 说明体积、许可证与替代方案。
- 不要提交 `data/`、`.env*`、`.next/`、`node_modules/`。
- 不要改 `.gitignore` 去放过数据库或密钥文件。
- 数据库 schema 变更必须保持向后兼容（`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN`），并在 PR 里说明迁移方式。

### 提交信息：Conventional Commits（中文摘要）

格式：

```text
<type>(<scope>): <中文摘要，不超过 50 字>

<为什么要改（动机、影响面）>

<关联 Issue，如 Refs #12>
```

`type` 取值：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`。

`scope` 示例：`editor` `ai` `outline` `bible` `archives` `settings` `db` `diff` `docs` `deps`。

示例：

```text
feat(diff): 支持按块回滚已采纳的 AI 修改

采纳后仍想撤回某一块时只能重来，给 BlockDiff 增加 revert 能力，
UI 里在已采纳块上显示「撤销」按钮。

Refs #42
```

一个提交只做一件事；格式化、重命名等无关改动请不要混进功能提交。

---

## 3. PR 流程

1. **先开 Issue**（bug 报告 / 功能提案 / 设计讨论）。小改动可以直接 PR，但请描述清楚动机。
2. Fork 并基于 `main` 拉分支：`feat/xxx`、`fix/xxx`、`docs/xxx`。
3. 小步提交，保持可编译；中途可以跑 `pnpm typecheck`。
4. 自测清单（在 PR 里贴结果）：
   - [ ] `pnpm typecheck` 通过
   - [ ] `pnpm test` 通过
   - [ ] 涉及 UI 时，在浅色/深色两个主题下截图（放到 PR 描述里即可）
   - [ ] 涉及 AI 时，分别用**演示模式**和至少一个真实 Provider 验证过流式与错误分支
   - [ ] 涉及 schema 时，用旧数据库启动验证过兼容性
5. PR 描述请写：**改了什么、为什么、怎么验证、有何破坏性变更**。
6. Review 合并后由维护者 squash 进 `main`，提交信息沿用你的标题。

CI（`.github/workflows/ci.yml`）会自动跑 `pnpm install --frozen-lockfile` → `tsc --noEmit` → `pnpm test` → `next build`。CI 不联网、不调用任何模型服务，你的 PR 不需要配置密钥。

---

## 4. 教程：如何新增一个 AI Provider

砚田的 Provider 层把「不同厂商的 HTTP 协议」收敛成一个 chunk 流。新增一类服务大约 30 行代码 + 一个下拉选项。

### 第一步：声明类型

在 `lib/types.ts` 扩展 `ProviderKind`：

```ts
export type ProviderKind = "openai" | "anthropic" | "gemini" | "ollama" | "demo" | "yourkind";
```

### 第二步：实现适配（`lib/ai/provider.ts`）

1. 在 `DEFAULT_BASE` 里加默认地址（用户不填 baseUrl 时使用）。
2. 在 `authHeaders()` 里加鉴权方式（Bearer / 自定义 header / query key）。
3. 在 URL 构造函数里拼出真正的 chat 端点。
4. 在 `streamCompletion()` 的 `switch (provider.kind)` 里加一个分支，把上游 SSE 逐条转成统一 chunk：

```ts
async function* streamYourKind(req: CompletionRequest): AsyncGenerator<ProviderChunk> {
  const response = await fetch(yourChatUrl(req.provider), {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(req.provider) },
    body: JSON.stringify({ model: req.model, messages: req.messages, stream: true }),
    signal: req.signal,
  });
  if (!response.ok) throw new ProviderError(await safeErrorText(response), response.status);

  for await (const payload of readSse(response)) {
    if (payload === "[DONE]") break;
    const json = safeJson(payload);
    const delta = pickString(get(json, "your", "delta", "path"));
    if (delta) yield { type: "delta", text: delta };
    const usage = get(json, "your", "usage");
    if (usage) yield { type: "usage", promptTokens: pickNumber(get(usage, "input_tokens")), completionTokens: pickNumber(get(usage, "output_tokens")) };
  }
  yield { type: "done" };
}
```

要点：

- 任何非 2xx 都要抛 `ProviderError(message, status)`，`message` 里带上游返回的原文（截断到合理长度），这样设置页的错误提示才可诊断。
- 推理内容（thought/thinking）单独 `yield { type: "reasoning", text }`，前端会折叠显示。
- 拿不到 usage 时不要编造；引擎会退化为字符数估算。

### 第三步：接上 UI

- 设置页的 Provider 类型下拉（`app/settings/**`）加一项中文标签与默认 baseUrl 占位。
- 「测试连接」复用 `testProvider()`，无需改逻辑。
- 顺手在 `lib/defaults.ts` 的 `PROVIDER_PRESETS` 里加一项预设（名称、类型、baseUrl、推荐模型与 contextWindow、环境变量键），设置页「快速添加」就会多一个品牌入口；不想要预设入口可以跳过。

### 第四步：文档与测试

- 在 `docs/ai-providers.md` 增加「样例：你的服务」一节（baseUrl、模型名、鉴权、已知坑）。
- 如果解析逻辑能抽成纯函数，在 `tests/` 补单测；协议解析可参考 `tests/providers.test.ts`（用 `node:http` 起本地假上游模拟 SSE，覆盖三种协议解析与 401 / 缺 Key 的中文错误），环境变量建 Provider 参考 `tests/seed-env.test.ts`（临时 SQLite）。目前全套 100 个用例，`pnpm test` 全绿是 PR 的硬要求。
- 本地用真实服务验证一遍流式输出与错误分支，PR 里贴 `ai_logs` 里的耗时截图。

---

## 5. 教程：如何新增一个 AI Feature（单点任务）

「续写/润色/章节体检」这类单点任务共用一条链路：**预设模板 + 上下文装配 + Provider + 事件 + 动作**。加一个任务分五处。

### 第一步：声明功能

`lib/types.ts`：

```ts
export type AiFeature = /* … */ | "your-feature";

export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  // …
  "your-feature": "你的任务名",
};
```

> 如果这个任务会产生正文或结构化数据，检查 `lib/ai/engine.ts` 的 `proseAction()`，决定它该使用 `insert` / `replace-selection` / `replace-chapter` / `save-*` 中的哪种 `AiAction`。

### 第二步：写内置预设

`lib/defaults.ts` 的 `BUILTIN_PRESETS` 里追加一项（结构见文件顶部的 `base()` 助手）：

```ts
base(
  "your-feature",
  "你的任务名",
  "你是……（system prompt：角色、输出约束、禁止事项）",
  "……{{chapter}}……{{selection}}……{{message}}……", // 可用占位符
  0.7,
  "prose", // chat | prose
),
```

可用占位符（由 `lib/ai/engine.ts` 的 `vars` 提供）：`{{context}}` `{{message}}` `{{selection}}` `{{chapter}}` `{{chapterTitle}}` `{{chapterGoal}}` `{{tail}}` `{{novelOutline}}` `{{words}}` `{{ratio}}` `{{instruction}}`。

约定：

- 模板里**不要**自己拼上下文——写 `{{context}}` 由装配器注入（装配器负责预算与裁剪，可被用户看到）。
- 输出是 JSON 的任务，必须写明「只输出 JSON，不要解释」，并在引擎里用 `extractJson()` 解析后做结构校验（参考「提取故事档案」）。

### 第三步：在引擎里处理（如需要）

多数文本任务无需改 `lib/ai/engine.ts`：`runTaskStream()` 会自动取预设、装配上下文、流式产出。仅当需要特殊输入/后处理时才加分支，例如：

```ts
const brief = feature === "your-feature" ? buildBrief(params) : "";
```

并把额外输出放进 `action.payload`，让前端以 diff 或表单形式呈现。

### 第四步：前端入口

- 编辑器 AI 面板的任务列表（通常按 `AI_FEATURE_LABEL` 与预设分组渲染；过滤掉未启用的预设即可自动出现）。
- 需要参数时（比如目标字数、改写角度），在面板里加一个小表单，通过 `streamAiTask({ feature, payload })` 传参。
- 快捷指令（quick actions）在 `lib/types.ts` 的 `AGENTS[].quickActions` 里加一条即可出现在对应智能体下。

### 第五步：文档与验证

- `docs/features.md` 的「19 个 AI 任务」表格增加一行。
- 用演示模式验证端到端（demo provider 对正文类提示词有稳定模板输出），再用真实模型验证质量。
- 检查生成内容在 diff 里是否可读、采纳后是否只改该改的块。

---

## 6. 文档写作

- 文档中文为主，代码/命令/字段名保留原文。
- 命令必须同时能在 Windows PowerShell 与 macOS/Linux 跑通；有差异就分两段写，并标注平台。
- 新增功能时同步：`README.md`（若属于对外能力）、`docs/features.md`、以及相关的 `docs/*.md`。
- 截图统一放 `docs/screenshots/`，命名见该目录的 README；演示用的作品请使用示例作品《潮信》，不要用真实书稿。

---

## 7. 提交前检查表

- [ ] 我读并遵守了[行为准则](./docs/code-of-conduct.md)
- [ ] `pnpm typecheck` 与 `pnpm test` 通过
- [ ] 没有提交 `data/`、密钥、`.env`、构建产物
- [ ] 没有新增未经讨论的依赖
- [ ] 中文注释、文案符合项目语气
- [ ] 相关文档已更新

有问题随时开 Issue，或在 PR 里 @ 维护者。祝写作愉快。
