/**
 * 砚田 Yanfield — 领域类型定义（前后端共享）
 *
 * 设计原则：
 * - 作品 > 卷 > 章 > 场景 四级结构；场景级规划放在章纲（ChapterBlueprint.scenes）里，
 *   正文本身仍以「章」为编辑单元，降低认知负担。
 * - 所有可被 AI 读取的资料都有 aiVisible / revealAtChapter 两个渐进披露开关。
 * - 故事档案（StoryArchive）是按章抽取的「事实账本」，不是摘要。
 */

export type ID = string;

/* ============================== 作品 / 卷 / 章 ============================== */

export type NovelStatus = "draft" | "serializing" | "completed" | "archived";

export interface Novel {
  id: ID;
  title: string;
  subtitle: string;
  author: string;
  genre: string;
  tags: string[];
  synopsis: string;
  /** 占位封面样式：预设渐变 key */
  coverKey: string;
  status: NovelStatus;
  /** 目标总字数 */
  wordGoal: number;
  targetChapters: number;
  /** 文风指南：叙述视角、语言风格、禁用词等，会进入 AI 上下文 */
  styleGuide: string;
  pov: string;
  forbiddenWords: string[];
  /** 主要角色速览（用于 AI 上文摘要，也可从 characters 生成） */
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface Volume {
  id: ID;
  novelId: ID;
  title: string;
  summary: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type ChapterStatus = "draft" | "revising" | "done";

export interface Chapter {
  id: ID;
  novelId: ID;
  volumeId: ID | null;
  title: string;
  /** 正文 HTML（Tiptap 序列化） */
  content: string;
  /** 本章摘要（作者或 AI 生成，进入后文上下文） */
  summary: string;
  status: ChapterStatus;
  orderIndex: number;
  wordCount: number;
  /** 备注：本章要写什么、修改待办 */
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/* ============================== 三级大纲 ============================== */

export interface NovelOutline {
  id: ID;
  novelId: ID;
  /** 一句话故事 */
  premise: string;
  theme: string;
  tone: string;
  /** 主线 */
  mainPlot: string;
  subplots: string[];
  characterArcs: { character: string; arc: string }[];
  worldRules: string[];
  /** 结局构想 */
  ending: string;
  /** 核心冲突 / 卖点 */
  hooks: string[];
  updatedAt: string;
}

export interface VolumeOutline {
  id: ID;
  volumeId: ID;
  novelId: ID;
  summary: string;
  arcGoal: string;
  keyEvents: string[];
  /** 本卷要收/埋的伏笔 */
  foreshadowPlan: string[];
  updatedAt: string;
}

export interface ScenePlan {
  id: string;
  title: string;
  summary: string;
  purpose: string;
  characters: string[];
  location: string;
  /** 情绪走向，如「压抑 → 爆发 → 余韵」 */
  emotion: string;
}

export interface ChapterBlueprint {
  id: ID;
  chapterId: ID;
  novelId: ID;
  /** 本章目标 / 一句话简介 */
  goal: string;
  pov: string;
  /** 核心冲突 */
  conflict: string;
  /** 情绪曲线 */
  emotionalArc: string;
  /** 分场计划 */
  scenes: ScenePlan[];
  /** 关键情节节点 */
  plotPoints: string[];
  /** 章末钩子 */
  hooks: string[];
  targetWords: number;
  notes: string;
  updatedAt: string;
}

/* ============================== 角色 / 世界观 / 伏笔 ============================== */

export type CharacterRole =
  | "protagonist"
  | "antagonist"
  | "supporting"
  | "mentor"
  | "ensemble"
  | "other";

export interface CharacterRelation {
  targetId: ID;
  relation: string;
  note: string;
}

export interface Character {
  id: ID;
  novelId: ID;
  name: string;
  aliases: string[];
  role: CharacterRole;
  gender: string;
  age: string;
  identity: string;
  appearance: string;
  /** 性格与行事逻辑 */
  personality: string;
  goals: string;
  secrets: string;
  /** 人物弧光 */
  arc: string;
  /** 说话风格 / 口头禅 */
  speechStyle: string;
  relations: CharacterRelation[];
  /** 当前状态（动态，档案会更新） */
  currentState: string;
  /** 对 AI 可见 */
  aiVisible: boolean;
  /** 从第几章开始对 AI 可见（null = 一直可见），防剧透 */
  revealAtChapter: number | null;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WorldCategory =
  | "power"
  | "geography"
  | "faction"
  | "item"
  | "rule"
  | "history"
  | "custom";

export interface WorldSetting {
  id: ID;
  novelId: ID;
  parentId: ID | null;
  title: string;
  category: WorldCategory;
  summary: string;
  content: string;
  tags: string[];
  aiVisible: boolean;
  revealAtChapter: number | null;
  orderIndex: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ForeshadowStatus = "planted" | "advanced" | "paid" | "dropped";

export interface Foreshadow {
  id: ID;
  novelId: ID;
  title: string;
  description: string;
  plantedChapterId: ID | null;
  payoffChapterId: ID | null;
  status: ForeshadowStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/* ============================== 故事档案 ============================== */

export type ArchiveStatus = "fresh" | "stale" | "pending";

export interface CharacterState {
  name: string;
  /** 本章结束时的状态：位置/伤势/心态/关系变化等 */
  state: string;
  /** 本章发生的变化 */
  changes: string;
}

export interface LedgerEntry {
  name: string;
  /** 本章变化，如 +2 */
  delta: string;
  /** 结余，如 7 */
  balance: string;
  note: string;
}

export interface TimelineEntry {
  storyTime: string;
  event: string;
}

export interface ArchiveConflict {
  topic: string;
  detail: string;
  status: "pending";
}

export interface StoryArchive {
  id: ID;
  novelId: ID;
  chapterId: ID | null;
  chapterTitle: string;
  orderIndex: number;
  /** 本章档案（事实摘要） */
  chapterSummary: string;
  characterStates: CharacterState[];
  settingStates: { title: string; state: string }[];
  ledger: LedgerEntry[];
  timeline: TimelineEntry[];
  foreshadows: { title: string; status: string; note: string }[];
  /** 待确认的冲突 */
  conflicts: ArchiveConflict[];
  status: ArchiveStatus;
  sourceWordCount: number;
  generatedBy: "ai" | "manual";
  model: string;
  createdAt: string;
  updatedAt: string;
}

/* ============================== 智能体 / AI ============================== */

export type AgentId =
  | "supervisor"
  | "blueprint"
  | "writer"
  | "archivist"
  | "critic"
  | "setting"
  | "consistency"
  | "structure"
  | "custom";

export interface AgentDef {
  id: AgentId;
  name: string;
  englishName: string;
  /** 一句话职责 */
  role: string;
  description: string;
  /** 该智能体强项（用于 UI 展示） */
  skills: string[];
  /** 主题色关键字，供 UI 映射 */
  tint: "accent" | "jade" | "gold" | "ink";
  /** 默认使用的模型角色 */
  modelRole: "chat" | "prose";
  /** 建议开场白 */
  greeting: string;
  /** 快捷指令 */
  quickActions: { label: string; prompt: string }[];
}

export type AiFeature =
  | "chat"
  | "continue"
  | "expand"
  | "polish"
  | "rewrite"
  | "deai"
  | "diagnose"
  | "outline-novel"
  | "outline-volume"
  | "outline-chapter"
  | "character-card"
  | "world-card"
  | "archive-extract"
  | "chapter-summary"
  | "imitate"
  | "titles"
  | "synopsis"
  | "consistency-check"
  | "pacing"
  | "custom";

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export type AiStreamEvent =
  | { type: "meta"; runId: string; feature: AiFeature; provider: string; model: string }
  | { type: "delta"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "action"; action: AiAction }
  | { type: "done"; usage: AiUsage; messageId?: ID }
  | { type: "error"; message: string; code?: string };

export type AiActionType =
  | "insert"
  | "append"
  | "replace-selection"
  | "replace-chapter"
  | "save-archive"
  | "save-outline"
  | "save-entity"
  | "save-blueprint";

export interface AiAction {
  id: string;
  type: AiActionType;
  /** 供 UI 展示的说明 */
  label: string;
  payload: unknown;
  applied: boolean;
  appliedAt?: string;
}

export interface ContextConfig {
  includeNovelOutline: boolean;
  includeVolumeOutline: boolean;
  includeChapterBlueprint: boolean;
  includeChapterSummaries: number;
  chapterSummaryMode: "summary" | "tail";
  includeArchives: boolean;
  archiveDepth: number;
  includeCharacters: boolean;
  characterDetail: "brief" | "standard" | "full";
  includeWorld: boolean;
  includeForeshadows: boolean;
  includeStyleGuide: boolean;
  includeSelection: boolean;
  customInstruction: string;
  /**
   * 上下文预算（token）。装配器会把大纲/档案/角色/设定等块按优先级塞进这个预算：
   * 超出时先丢弃低优先级块，再截断最长的块。0 = 不限制（小心模型上下文窗口）。
   */
  contextBudget: number;
  /** 单次输出上限（token），0 = 用模型默认值 */
  maxTokens: number;
}

export interface ChatSession {
  id: ID;
  novelId: ID;
  chapterId: ID | null;
  title: string;
  agentId: AgentId;
  mode: "chat" | "collaborate";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: ID;
  sessionId: ID;
  role: "user" | "assistant";
  content: string;
  actions: AiAction[];
  status: "complete" | "streaming" | "error" | "aborted";
  provider: string;
  model: string;
  usage: AiUsage | null;
  error: string;
  createdAt: string;
}

/* ============================== 模型 / 提示词 / 日志 ============================== */

export type ProviderKind = "openai" | "anthropic" | "gemini" | "ollama" | "demo";

export interface ModelOption {
  id: string;
  label: string;
  /** 模型上下文窗口（token），用于在 UI 里提示预算上限 */
  contextWindow?: number;
}

export interface ProviderConfig {
  id: ID;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  /** API Key（本地存储；读取接口做掩码） */
  apiKey: string;
  models: ModelOption[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelSetting {
  /** 对话/大纲用模型 */
  chat: { providerId: ID | null; model: string };
  /** 正文用模型 */
  prose: { providerId: ID | null; model: string };
}

export interface PromptPreset {
  id: ID;
  novelId: ID | null;
  feature: AiFeature;
  name: string;
  systemPrompt: string;
  userTemplate: string;
  temperature: number;
  modelRole: "chat" | "prose";
  isBuiltin: boolean;
  enabled: boolean;
  updatedAt: string;
}

export type AiLogStatus = "ok" | "error" | "aborted";

/* ============================== AI 请求载荷（前后端共享） ============================== */

export interface AiChatRequest {
  novelId: ID;
  chapterId?: ID | null;
  sessionId?: ID | null;
  agentId?: AgentId;
  /** 用户消息 */
  message: string;
  /** 会话模式：普通对话 / 多智能体协作 */
  mode?: "chat" | "collaborate";
  /** 覆盖默认上下文配置 */
  context?: Partial<ContextConfig>;
  /** 选中的正文片段（供改写/润色使用） */
  selection?: string;
  presetId?: ID | null;
  /** 引用资料（@ 到的角色/设定/章节） */
  mentions?: { type: "character" | "world" | "chapter" | "archive" | "foreshadow"; id: ID; label: string }[];
}

export interface AiTaskRequest {
  novelId: ID;
  chapterId?: ID | null;
  feature: AiFeature;
  /** 用户补充要求 */
  message?: string;
  /** 选中的正文片段 */
  selection?: string;
  context?: Partial<ContextConfig>;
  presetId?: ID | null;
  targetWords?: number;
  instruction?: string;
}

export interface AiLog {
  id: ID;
  novelId: ID | null;
  chapterId: ID | null;
  feature: AiFeature;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  status: AiLogStatus;
  error: string;
  promptPreview: string;
  responsePreview: string;
  createdAt: string;
}

/* ============================== 设置 / 统计 / 导入导出 ============================== */

export interface AppSettings {
  theme: "light" | "dark" | "system";
  editorFontSize: number;
  editorLineHeight: number;
  proseFont: "serif" | "sans";
  firstLineIndent: boolean;
  autoSave: boolean;
  autoSaveDelayMs: number;
  typewriterMode: boolean;
  focusMode: boolean;
  /** 编辑显示：底部状态栏 */
  showStatusBar: boolean;
  /** 正文内联提示（AI 建议、字数/节奏提示等） */
  showInlineHints: boolean;
  /** 界面动效（关闭后减少过渡/动画） */
  motionEnabled: boolean;
  /** 正文字重：300 / 400 / 500 / 600 */
  editorFontWeight: number;
  /** 正文字间距（em） */
  editorLetterSpacing: number;
  /** 段落间距（px） */
  paragraphSpacing: number;
  /** 正文左右页边距（px） */
  pagePaddingX: number;
  /** 正文上下页边距（px） */
  pagePaddingY: number;
  /** 正文最大行宽（px；0 = 自适应容器） */
  maxContentWidth: number;
  defaultContext: ContextConfig;
  dailyWordGoal: number;
  /** 双模型分工：对话/大纲模型 vs 正文模型 */
  models: ModelSetting;
  /** 自定义智能体人设（AGENTS 里 id=custom 时使用） */
  customAgent: { name: string; role: string; persona: string; greeting: string };
  /** 费用估算单价，人民币 / 百万 tokens。两项都为 0 时只统计 token。 */
  aiPricing: AiPricing;
}

export interface AiPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface DashboardStats {
  totalWords: number;
  todayWords: number;
  weekWords: number;
  novelCount: number;
  chapterCount: number;
  doneChapters: number;
  aiCalls: number;
  aiTokens: number;
  aiPromptTokens: number;
  aiCompletionTokens: number;
  todayAiCalls: number;
  todayPromptTokens: number;
  todayCompletionTokens: number;
  streakDays: number;
  recentNovels: Pick<Novel, "id" | "title" | "genre" | "coverKey" | "updatedAt" | "wordGoal">[];
  daily: { date: string; words: number; aiTokens: number }[];
}

export interface ImportChapterDraft {
  title: string;
  content: string;
  volumeTitle?: string;
}

export interface ImportOptions {
  mode: "split" | "single";
  volumeTitle: string;
  stripMarkdown: boolean;
  generateSummary: boolean;
}

export interface SearchResult {
  type: "novel" | "chapter" | "character" | "world" | "archive";
  id: ID;
  novelId: ID;
  title: string;
  snippet: string;
  chapterId?: ID;
}

/* ============================== 常量 ============================== */

export const NOVEL_STATUS_LABEL: Record<NovelStatus, string> = {
  draft: "草稿",
  serializing: "连载中",
  completed: "已完结",
  archived: "已归档",
};

export const CHAPTER_STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: "草稿",
  revising: "修改中",
  done: "定稿",
};

export const CHARACTER_ROLE_LABEL: Record<CharacterRole, string> = {
  protagonist: "主角",
  antagonist: "反派",
  supporting: "配角",
  mentor: "导师",
  ensemble: "群像",
  other: "其他",
};

export const WORLD_CATEGORY_LABEL: Record<WorldCategory, string> = {
  power: "力量体系",
  geography: "地理",
  faction: "势力",
  item: "物品",
  rule: "规则",
  history: "历史",
  custom: "自定义",
};

export const FORESHADOW_STATUS_LABEL: Record<ForeshadowStatus, string> = {
  planted: "已埋设",
  advanced: "推进中",
  paid: "已回收",
  dropped: "已放弃",
};

export const GENRES = [
  "玄幻",
  "仙侠",
  "都市",
  "科幻",
  "悬疑",
  "历史",
  "奇幻",
  "言情",
  "游戏",
  "武侠",
  "轻小说",
  "其他",
] as const;

export const COVER_KEYS = [
  "ink",
  "cinnabar",
  "jade",
  "gold",
  "night",
  "mist",
  "bamboo",
  "azure",
] as const;

export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  chat: "智能体对话",
  continue: "AI 续写",
  expand: "扩写",
  polish: "润色",
  rewrite: "改写",
  deai: "去 AI 味",
  diagnose: "章节体检",
  "outline-novel": "生成总纲",
  "outline-volume": "生成卷纲",
  "outline-chapter": "生成章纲",
  "character-card": "角色卡补全",
  "world-card": "设定卡补全",
  "archive-extract": "提取故事档案",
  "chapter-summary": "本章摘要",
  imitate: "爆款仿写",
  titles: "起名",
  synopsis: "简介",
  "consistency-check": "一致性检查",
  pacing: "节奏分析",
  custom: "自定义任务",
};

export const ARCHIVE_STATUS_LABEL: Record<ArchiveStatus, string> = {
  fresh: "最新",
  stale: "已过期",
  pending: "待确认",
};

export const AGENTS: AgentDef[] = [
  {
    id: "supervisor",
    name: "主编",
    englishName: "Supervisor",
    role: "统筹整本书的创作节奏",
    description:
      "拆解你的写作目标，安排谁来做什么；卡文时帮你判断该先补设定、改大纲，还是直接硬写。",
    skills: ["任务拆解", "写作卡点诊断", "多智能体调度", "整书节奏建议"],
    tint: "accent",
    modelRole: "chat",
    greeting:
      "我是你的主编。告诉我今天想推进什么——续写下一章、梳理大纲，还是解决某个卡点？我会给出路线并调度合适的智能体。",
    quickActions: [
      { label: "诊断我的卡点", prompt: "我卡文了，请先了解我的作品状态，再判断问题出在大纲、设定还是动机，并给出具体下一步。" },
      { label: "规划今日写作", prompt: "请根据当前进度，帮我规划今天 2 小时的写作任务，要具体到章节与目标字数。" },
      { label: "调度写作智能体", prompt: "按「先补章纲 → 再写正文 → 最后抽档案」的顺序，安排接下来的工作。" },
    ],
  },
  {
    id: "blueprint",
    name: "策划",
    englishName: "Blueprint",
    role: "大纲、分场与结构设计",
    description:
      "把模糊的想法变成可执行的三级大纲与分场计划：先总纲，再卷纲，最后落到章纲的冲突、钩子与情绪曲线。",
    skills: ["总纲/卷纲/章纲", "分场设计", "冲突与钩子", "节奏曲线"],
    tint: "jade",
    modelRole: "chat",
    greeting:
      "我是策划。你给我题材、主角和想要的爽点，我帮你搭出三级大纲；已经有大纲的话，我可以帮你检查结构漏洞。",
    quickActions: [
      { label: "搭建总纲", prompt: "请根据现有作品信息，为我生成一份总纲：一句话故事、主题、主线、支线、人物弧光与结局走向。" },
      { label: "生成本章章纲", prompt: "请结合前后章与大纲，生成本章章纲：目标、核心冲突、分场计划、章末钩子。" },
      { label: "检查结构", prompt: "请检查当前卷的结构：主线推进是否够、冲突是否升级、有没有拖沓或断档。" },
    ],
  },
  {
    id: "writer",
    name: "写作",
    englishName: "Writer",
    role: "正文创作与续写",
    description:
      "接住前情与设定，直接产出可用的正文。支持续写、扩写、润色、改写，并保持你的叙述视角与文风。",
    skills: ["续写正文", "扩写润色", "对话打磨", "文风模仿"],
    tint: "accent",
    modelRole: "prose",
    greeting:
      "我是写作智能体。你可以选中正文片段让我接着写、扩写或润色；也可以直接说「续写下一段」。",
    quickActions: [
      { label: "续写下一段", prompt: "请接着正文最后一段继续写 600 字左右，保持当前视角与节奏，结尾留一个小钩子。" },
      { label: "润色选中内容", prompt: "请润色选中的段落：修掉重复和口头禅，让动作与心理更具体，保持原意与篇幅。" },
      { label: "写一段对话戏", prompt: "请根据当前场景写一段人物对话，体现两人关系张力，减少说明性台词。" },
    ],
  },
  {
    id: "archivist",
    name: "档案",
    englishName: "Archivist",
    role: "抽取故事档案与连续性事实",
    description:
      "从本章正文里抽取只发生过的事实：角色状态、设定变化、数值总账、时间线与伏笔；推不出的不编，冲突列待确认。",
    skills: ["本章档案", "角色状态", "数值总账", "时间线", "伏笔追踪"],
    tint: "gold",
    modelRole: "chat",
    greeting:
      "我是档案智能体。写完一章后找我抽取档案，我会只记录正文里真实发生的事；发现前后矛盾会列成「待确认」。",
    quickActions: [
      { label: "抽取本章档案", prompt: "请从本章正文抽取故事档案：本章摘要、角色状态变化、设定变化、数值总账、时间线、伏笔，以及冲突待确认项。" },
      { label: "检查前后一致性", prompt: "请对照既有档案检查本章：有没有和前面章节矛盾的地方？列成待确认清单。" },
      { label: "补建全书档案", prompt: "请按顺序梳理已写章节，生成缺失的故事档案。" },
    ],
  },
  {
    id: "critic",
    name: "审稿",
    englishName: "Critic",
    role: "去 AI 味、改稿与章节体检",
    description:
      "用网文编辑的标准挑毛病：AI 味、节奏拖沓、信息密度、爽点与钩子；并给出可以直接采纳的改写版本。",
    skills: ["去 AI 味", "章节体检", "爽点/钩子", "逐段改写"],
    tint: "accent",
    modelRole: "prose",
    greeting:
      "我是审稿智能体。把章节发给我，我会指出 AI 味和节奏问题，并给出可逐段采纳的修改；也可以只做「去 AI 味」。",
    quickActions: [
      { label: "给本章做体检", prompt: "请从读者视角给本章做体检：开头钩子、信息密度、冲突推进、爽点、章末悬念、AI 味，逐项打分并给修改建议。" },
      { label: "去 AI 味", prompt: "请去除本章的 AI 味：删掉空泛排比与总结句，把抽象形容改成具体动作与感官细节，打散过于齐整的句式。" },
      { label: "加强章末钩子", prompt: "请改写本章最后 3 段，让章末钩子更强，但不要剧透下一章的具体解法。" },
    ],
  },
  {
    id: "setting",
    name: "设定",
    englishName: "Setting",
    role: "世界观与角色资料补全",
    description:
      "把正文里出现过的设定沉淀成结构化资料卡；也能反向补全：给你一个想法，生成可用的力量体系、势力与人物关系。",
    skills: ["角色卡", "力量体系", "势力关系", "设定树"],
    tint: "jade",
    modelRole: "chat",
    greeting:
      "我是设定智能体。你可以让我把正文里的设定整理成资料卡，也可以从零设计一套力量体系或一群角色。",
    quickActions: [
      { label: "补全角色卡", prompt: "请根据正文里出现的信息，补全当前主要角色的资料卡，缺失字段请用「待确认」标注，不要编造。" },
      { label: "设计力量体系", prompt: "请为本书设计一套有代价、有上限的力量体系，包含等级、晋升条件、常见战斗形态和叙事限制。" },
      { label: "梳理势力关系", prompt: "请梳理目前出现的势力及其关系，指出矛盾点与可开发的冲突。" },
    ],
  },
  {
    id: "consistency",
    name: "考据",
    englishName: "Consistency",
    role: "知识图谱与全书一致性",
    description:
      "跨章节核对人物、时间、数值、地理与因果：谁在第几章知道了什么、死了的人有没有再出现、境界有没有跳级。",
    skills: ["跨章核对", "时间线", "数值校验", "因果链"],
    tint: "jade",
    modelRole: "chat",
    greeting:
      "我是考据智能体。选中章节范围，我会对照档案与设定，找出前后矛盾并按严重程度排序。",
    quickActions: [
      { label: "全书一致性检查", prompt: "请检查全书已写内容的一致性：人物状态、时间线、数值、地理与因果，按严重程度列出问题与依据章节。" },
      { label: "核对本章设定", prompt: "请核对本章涉及的设定与既有设定是否冲突，冲突处给出两套修正方案。" },
      { label: "检查伏笔回收", prompt: "请盘点已埋伏笔的回收情况，指出逾期未回收的伏笔并建议回收章节。" },
    ],
  },
  {
    id: "structure",
    name: "结构",
    englishName: "Structure",
    role: "节奏、爽点与追读率分析",
    description:
      "从数据与结构角度分析：章节节奏曲线、爽点密度、信息释放速度、黄金三章，并对比同类爆款的常见节拍。",
    skills: ["节奏分析", "黄金三章", "追读率", "爆款对标"],
    tint: "gold",
    modelRole: "chat",
    greeting:
      "我是结构智能体。给我一段章节或全书目录，我会分析节奏与爽点分布，告诉你读者可能在哪里流失。",
    quickActions: [
      { label: "节奏分析", prompt: "请分析当前章节/卷的节奏：紧张与松弛的分布、信息密度、爽点间隔，给出调整建议。" },
      { label: "黄金三章体检", prompt: "请按网文黄金三章标准给前三章打分：代入感、冲突、金手指/悬念、爽点、章末钩子。" },
      { label: "对标爆款节拍", prompt: "请按同类爆款的常见节拍，指出本书前 10 章哪些节点可以更早出现或加强。" },
    ],
  },
];

export const CUSTOM_AGENT: AgentDef = {
  id: "custom",
  name: "自定义",
  englishName: "Custom Agent",
  role: "按你的设定扮演专属编辑",
  description: "自定义人设、职责与说话方式，适合固定分工的写作流程。",
  skills: ["自定义人设", "固定职责", "专属语气"],
  tint: "ink",
  modelRole: "chat",
  greeting: "请先在设置里定义我的人设与职责，然后我们就可以开始了。",
  quickActions: [],
};

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  includeNovelOutline: true,
  includeVolumeOutline: true,
  includeChapterBlueprint: true,
  includeChapterSummaries: 3,
  chapterSummaryMode: "summary",
  includeArchives: true,
  archiveDepth: 3,
  includeCharacters: true,
  characterDetail: "standard",
  includeWorld: true,
  includeForeshadows: true,
  includeStyleGuide: true,
  includeSelection: true,
  customInstruction: "",
  contextBudget: 12000,
  maxTokens: 0,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "light",
  editorFontSize: 18,
  editorLineHeight: 1.95,
  proseFont: "serif",
  firstLineIndent: true,
  autoSave: true,
  autoSaveDelayMs: 1200,
  typewriterMode: false,
  focusMode: false,
  showStatusBar: true,
  showInlineHints: true,
  motionEnabled: true,
  editorFontWeight: 400,
  editorLetterSpacing: 0.02,
  paragraphSpacing: 12,
  pagePaddingX: 64,
  pagePaddingY: 48,
  maxContentWidth: 720,
  defaultContext: DEFAULT_CONTEXT_CONFIG,
  dailyWordGoal: 3000,
  models: {
    chat: { providerId: null, model: "" },
    prose: { providerId: null, model: "" },
  },
  customAgent: {
    name: "专属编辑",
    role: "按作者设定扮演固定分工的编辑",
    persona: "你是一位熟悉本书题材与作者文风的编辑，说话直接，只给具体可执行的建议。",
    greeting: "我已按你的设定就位。今天想让我做什么？",
  },
  aiPricing: {
    inputPerMillion: 0,
    outputPerMillion: 0,
  },
};

/** 预置封面渐变（不依赖外部图片） */
export const COVER_STYLES: Record<string, { from: string; to: string; ink: string; label: string }> = {
  ink: { from: "#2e3338", to: "#15181b", ink: "#e8e3d8", label: "墨夜" },
  cinnabar: { from: "#8f3123", to: "#4a1c15", ink: "#f3e2dc", label: "朱砂" },
  jade: { from: "#2f5d62", to: "#173236", ink: "#dfeae8", label: "黛青" },
  gold: { from: "#8a6520", to: "#3f2e0e", ink: "#f6ead0", label: "鎏金" },
  night: { from: "#1f2a4a", to: "#0d1220", ink: "#dde3f2", label: "夜航" },
  mist: { from: "#8e958f", to: "#4c524e", ink: "#f2f4f1", label: "远山" },
  bamboo: { from: "#4a6b45", to: "#22331f", ink: "#e6efe1", label: "青竹" },
  azure: { from: "#3a5f8a", to: "#1b2c44", ink: "#e3ecf6", label: "天青" },
};
