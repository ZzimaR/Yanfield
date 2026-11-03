# AI 服务配置指南

砚田不绑定任何模型厂商。设置页里新增一个 Provider，选择类型、填 `baseUrl`、密钥与模型名，即可在对话和写作里使用。

> 配置入口：点左下角齿轮（或书架 / 编辑器里的设置入口）打开**设置悬浮窗** → **模型服务 → 新增服务**。密钥只保存在你本机的 `data/yanfield.db`，不上传任何服务器；但它是**明文存储**的，不要把数据库文件分享给别人。

## 一步接入：内置 11 家服务商预设

设置页 **模型服务 → 新增服务 → 快速添加** 保留服务商地址与协议预设，不再内置推荐模型。填写 Key 后，主动点击 **拉取模型列表** 获取账户当前可用的模型；不支持列出模型的网关可以手动填写模型 ID。

- 打开设置或选择品牌不会自动联网拉取。
- 新服务的模型列表为空；已有配置升级后保留，不会被清空。
- 显式拉取成功后，以这次返回的列表替换表单里的旧列表；点击「保存」才保存服务配置。拉取失败保留原列表。
- 接口未返回上下文容量或价格时，不会根据旧预设冒充实时信息；请按服务商文档填写。

## 环境变量自动创建 Provider（可选）

服务端首次初始化（`ensureReady()`）会读取以下环境变量，按预设自动创建 Provider；**已有同名 Provider 会跳过**，不会覆盖你在设置页里手改过的配置。如果当前默认模型还指向「离线演示模式」，会选中第一个创建成功的真实服务；品牌服务仍需手动拉取并选择模型。

| 环境变量 | 对应预设 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `DASHSCOPE_API_KEY` | 通义千问 |
| `MOONSHOT_API_KEY` | Moonshot / Kimi |
| `ZHIPU_API_KEY` | 智谱 GLM |
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENROUTER_API_KEY` | OpenRouter |
| `SILICONFLOW_API_KEY` | 硅基流动 |
| `OLLAMA_BASE_URL` | Ollama（免 Key） |
| `YANFIELD_OPENAI_COMPAT_BASE_URL` + `_API_KEY` + `_MODEL` | 自定义 OpenAI 兼容（`_MODEL` 可填写实际模型 ID；留空则之后手动拉取） |

完整模板见仓库根目录 [`.env.example`](../.env.example)。不填任何变量、只在设置页里配，也完全等价——环境变量只是首次启动的便捷预置。

## 五种连接类型

| 类型 | 协议 | 典型服务 |
| --- | --- | --- |
| OpenAI 兼容 | `/chat/completions` + Bearer | OpenAI、DeepSeek、Moonshot/月之暗面、智谱、硅基流动、OpenRouter、vLLM、LM Studio、One API 网关 |
| Anthropic | `/v1/messages` + `x-api-key` | Claude 官方 API |
| Gemini | `generativelanguage` + query `key` | Google AI Studio（Gemini API） |
| Ollama | OpenAI 兼容协议 | 本机 Ollama |
| 演示模式 | 内置，不联网 | 首次启动的离线体验 |

### baseUrl 怎么填

砚田会自动补全路径，你只需要填到「版本前缀」这一层：

| 你填的 baseUrl | 实际请求地址 |
| --- | --- |
| `https://api.deepseek.com` | `https://api.deepseek.com/v1/chat/completions` |
| `https://api.deepseek.com/v1` | `https://api.deepseek.com/v1/chat/completions` |
| `https://api.openai.com/v1` | `https://api.openai.com/v1/chat/completions` |
| `https://xxx/v1/chat/completions` | 原样使用 |
| `http://127.0.0.1:11434/v1` | `http://127.0.0.1:11434/v1/chat/completions` |
| `https://api.anthropic.com` | `https://api.anthropic.com/v1/messages` |
| `https://generativelanguage.googleapis.com` | `https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent?alt=sse&key=…` |

> 上面出现的模型 ID 随厂商发版变化，配置时以服务商控制台/文档为准；砚田只负责原样传给上游。

## 样例一：DeepSeek（国内最省事的云端方案）

| 项 | 值 |
| --- | --- |
| 类型 | OpenAI 兼容 |
| 名称 | `DeepSeek` |
| baseUrl | `https://api.deepseek.com/v1` |
| 密钥 | `sk-…`（platform.deepseek.com 申请） |
| 模型 | `deepseek-chat`（对话/规划）、`deepseek-reasoner`（推理，会返回思考过程） |

建议：`chat` 模型用 `deepseek-chat`，`prose` 模型也用 `deepseek-chat`（推理模型的思考内容不适合直接写正文，但可以拿来写大纲和诊断）。DeepSeek 支持 OpenAI 的流式协议与 `stream_options.include_usage`，砚田能拿到完整 token 用量。

## 样例二：OpenAI

| 项 | 值 |
| --- | --- |
| 类型 | OpenAI 兼容 |
| baseUrl | `https://api.openai.com/v1` |
| 密钥 | `sk-…` |
| 模型示例 | `gpt-4o`、`gpt-4o-mini`、`gpt-4.1`、`gpt-4.1-mini` |

注意：

- 如果所在网络需要代理，请把代理配置到**运行砚田的进程**上（`HTTP_PROXY` / `HTTPS_PROXY` 环境变量），而不是浏览器。
- 组织账号需要额外 header 时，砚田 0.1.0 未暴露自定义 header 字段；可先用兼容网关（如 one-api）转发。
- 单次输出上限 `maxTokens = 0` 表示不限制，由上游默认值决定；**输入侧的长短由「上下文预算」控制**，见下文【上下文预算与输出上限】。

## 样例三：Anthropic Claude

| 项 | 值 |
| --- | --- |
| 类型 | Anthropic |
| baseUrl | `https://api.anthropic.com` |
| 密钥 | `sk-ant-…` |
| 模型示例 | `claude-sonnet-4-5`、`claude-opus-4-1`、`claude-haiku-4-5` |

砚田按 Anthropic Messages API 发送：`system` 单独成字段、`max_tokens` 必填（默认 4096）、`anthropic-version: 2023-06-01`。流式事件 `content_block_delta` 的 `thinking_delta` 会显示为「思考过程」，`text_delta` 是正文。Claude 对中文长篇的风格控制很好，适合当 `prose` 模型。

## 样例四：Google Gemini

| 项 | 值 |
| --- | --- |
| 类型 | Gemini |
| baseUrl | `https://generativelanguage.googleapis.com` |
| 密钥 | AI Studio 生成的 API Key |
| 模型示例 | `gemini-2.5-pro`、`gemini-2.5-flash` |

- 密钥通过 query 参数传递（Google 的规定），砚田已处理好；日志里不会打印完整 URL。
- 使用 `streamGenerateContent?alt=sse` 流式；`systemInstruction` 承载系统提示词，`generationConfig.maxOutputTokens` 承载上限。
- 若返回 404，通常是模型名或 API 版本不对：确认模型 ID 与 `v1beta` 是否支持该模型。

## 样例五：本地 Ollama（完全离线）

1. 安装 Ollama 并拉一个中文能力尚可的模型：

   ```bash
   ollama pull qwen2.5:14b
   # 或推理模型
   ollama pull deepseek-r1:7b
   ```

2. 确认服务在跑（默认端口 11434）：

   ```bash
   curl http://127.0.0.1:11434/v1/models
   ```

3. 在砚田里新增 Provider：

| 项 | 值 |
| --- | --- |
| 类型 | Ollama |
| 名称 | `本地 Ollama` |
| baseUrl | `http://127.0.0.1:11434/v1` |
| 密钥 | 留空 |
| 模型 | `qwen2.5:14b`、`deepseek-r1:7b`（与 `ollama list` 输出的名字一致） |

注意：

- **上下文长度**：Ollama 默认 `num_ctx` 往往只有 2K～4K，长篇会被截断。启动时调大：`OLLAMA_CONTEXT_LENGTH=16384 ollama serve`（新版本）或在 Modelfile 里改 `num_ctx`。
- **速度**：7B～14B 模型在消费级显卡上写 1000 字大约需要几十秒，属正常；预算紧张时可以用小模型写正文、需要规划时切到旗舰模型。
- 如果用 Docker 部署砚田，`127.0.0.1` 指向容器内部，需改成宿主机地址（Linux 用 `172.17.0.1`，macOS/Windows 用 `host.docker.internal`）。
- LM Studio、vLLM、llama.cpp server 同理：选「OpenAI 兼容」，baseUrl 填它们的 `/v1` 地址。

## 默认模型（单一）

AI 对话与所有写作任务（续写 / 润色 / 诊断 / 大纲 / 档案提取……）都使用**同一个默认模型**，在设置页「模型服务 → 默认模型」里选择：按 Provider 分组列出全部已启用模型，随时可切换。

- 没有「对话模型 / 正文模型 / 推理模型」的角色划分，也不强制某类任务必须用某个模型——由你自己选。
- 首次添加服务时会自动把它的第一个模型设为默认；删掉当前默认模型所属的服务后，需要重新选一个。
- 内部仍以 `settings.models.chat` 与 `settings.models.prose` 两个字段存储，但界面上选一次会同时写入这两个字段（值相同），所以行为就是「一个默认模型」。
- AI 面板输入区底部也有同样的模型选择器；点「拉取模型列表 / 管理模型服务」会直接打开设置悬浮窗的模型服务页。

## 上下文预算与输出上限

两个量容易混淆，文档和界面里也刻意分开叫：

| 概念 | 配置字段 | 默认 | 作用 |
| --- | --- | --- | --- |
| **上下文预算** | `ContextConfig.contextBudget` | `12000` token | 每次请求最多带多少资料（大纲 / 摘要 / 档案 / 角色卡 / 设定…）进提示词；`0` = 不限。超预算时按优先级从低到高裁剪相关维度，并在上下文面板提示。 |
| **单次输出上限** | `ContextConfig.maxTokens` | `0`（不限） | 这一次生成最多写多少 token；`0` 交给上游默认值（Anthropic 兜底 4096）。 |

**预算不要超过所选模型的上下文窗口**，否则上游会报超长或悄悄截断。设置页的模型列表会显示 `contextWindow`，常见值：

| 模型 | 上下文窗口 |
| --- | --- |
| DeepSeek `deepseek-chat` | 64K |
| OpenAI `gpt-4o` | 128K |
| OpenAI `gpt-4.1` | 1M |
| Anthropic `claude-sonnet-4-5` | 200K |
| Google `gemini-2.5-pro` | 1M |
| 本地 Ollama | 默认 `num_ctx` 往往 2K–4K，需自行调大 |

经验值：短篇 4k 足够；连载长篇建议 8k–32k；把预算顶到模型窗口上限通常既贵又慢，也更容易「细节记得住、主线丢了」。

## 常见错误排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| **401 Unauthorized** / `invalid api key` | 密钥错误、过期、带了多余空格或换行 | 重新粘贴密钥；确认没有把 `Bearer` 写进密钥框 |
| **403 Forbidden** | 密钥无该模型权限，或地区限制 | 换模型或换账号；Anthropic 需先开通对应模型 |
| **404 Not Found** | baseUrl 多写/少写了路径前缀；模型名不存在 | 按上表核对 baseUrl；模型名与厂商文档逐字一致 |
| **404 model not found** | 模型未上线/名字拼错 | 在服务商控制台复制模型 ID |
| **429 Too Many Requests / 额度不足** | 触发限流或余额耗尽 | 降低并发、等待重试或充值；砚田会把错误原文显示在面板上 |
| **连接超时 / `fetch failed`** | 本机网络、代理、Ollama 未启动、Docker 网络隔离 | 用 `curl` 直接请求同一地址验证；检查 `HTTP_PROXY`；Docker 里用 `host.docker.internal` |
| **CORS 报错** | 只有「浏览器直连上游」才会遇到；砚田的请求由服务端发出，正常不会出现 | 若你把 `YANFIELD_*` 接口直接暴露给别的前端页面，需要在网关加 CORS 头 |
| **流式不返回 / 一直转圈** | 上游不支持 `stream: true`；反向代理缓冲了 SSE；网关把 SSE 改成了 JSON | 换支持流式的模型/服务；Nginx 加 `proxy_buffering off; proxy_cache off;`；把超时调到 10 分钟以上 |
| **返回空内容** | 模型被内容策略拦截、`max_tokens` 太小、消息为空 | 查看 `ai_logs` 与面板错误；调大 `max_tokens`；改用非推理模型写正文 |
| **只回思考不回正文** | 推理模型的思考落在 `reasoning` 事件里 | 展开「思考过程」；把默认模型换成非推理模型 |
| **中文乱码 / 半句截断** | 上游编码问题或连接被提前关闭 | 检查网关；降低单次生成长度（上下文面板可调） |
| **调用成功但很慢** | 上下文过长、本地模型算力不足 | 在上下文面板关掉不必要的维度，或调小上下文预算 / 单次输出上限 |

排障顺序建议：**先点「测试连接」**（只发 8 个 token，20 秒超时，能最快区分密钥/地址/网络问题）→ 再看右上角错误提示 → 最后查设置页的 AI 调用日志（功能、模型、耗时、token、错误码）。

## 费用与隐私提示

- 砚田不做代理、不抽成、不上报用量；每次请求直接由你的机器发往你配置的服务。
- 设置 →「AI 与上下文」里的「用量与费用」会记下今日和累计的输入 / 输出 token。填上你的单价（元 / 百万 tokens）后显示估算金额；不填则只统计 token。这是估算，实际扣费以服务商账单为准。
- 长上下文 = 高费用：调小上下文预算、关掉不必要维度、用「前 N 章摘要」替代全文，都能显著降本。
- 密钥明文存在本地数据库；公用电脑上建议用「演示模式」或本地 Ollama，用完在设置里清空密钥。
- 演示模式（`kind: demo`）完全不联网，适合先熟悉 diff 审批流程。

## 思考程度

模型选择菜单按「服务商 + 模型」分别记忆设置；新模型使用「默认」，不额外指定思考参数。重新拉取后若旧档位已不被支持，会回退默认，不发送失效值。已有显式设置仍在支持范围内则继续使用。

模型列表拉取会保存能力元数据、上下文容量与输出上限。显示哪些强度取决于接口返回，不能统一套四个档位。

| 接口 | 能力来源 | 请求参数与边界 |
| --- | --- | --- |
| DeepSeek 官方 | `effort.supported_levels/default_level` | `thinking.type` 与 `reasoning_effort`；兼容旧配置的名称兜底仅限官方地址 |
| Anthropic Messages | `capabilities.effort`、`capabilities.thinking.types.disabled` | `output_config.effort`；只有明确支持 disabled 才显示关闭。强度调节不是通用的思考开关 |
| OpenRouter 官方 | `reasoning.supported_efforts/default_effort/mandatory` | `reasoning.effort`；只有明确非强制时才显示关闭 |
| Gemini | `thinking` 布尔值 | 保存是否支持；列表没声明档位时不编造等级，使用服务商默认 |
| 其他兼容网关 | 保留可识别的能力声明与支持参数 | 未确认请求协议时使用默认，不仅凭模型同名发送 DeepSeek 参数 |

接口声明不支持与接口未提供信息是两种状态，菜单会分别说明。旧服务需主动重新拉取并保存，才能补充能力信息；拉取不会自动发起生成请求或消耗生成 token。使用手动模型 ID 而没有能力信息时，默认保持未知。

强度可能影响等待时间和 token 消耗，不同模型含义与默认行为由服务商决定。DeepSeek 原生工具模式在本轮内传回必要的 reasoning_content，不把它显示为执行过程说明。

依据：[DeepSeek 模型列表](https://api-docs.deepseek.com/api/list-models/)、[DeepSeek 思考模式](https://api-docs.deepseek.com/guides/thinking_mode/)、[Claude 模型列表](https://platform.claude.com/docs/en/api/models/list)、[Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort)、[OpenRouter reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)、[Gemini 模型元数据](https://ai.google.dev/api/models)。
