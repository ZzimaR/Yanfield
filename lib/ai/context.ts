/**
 * 上下文装配器（服务端）
 *
 * 目标：把「作品大纲 / 卷纲 / 章纲 / 前文章节摘要 / 故事档案 / 角色 / 世界观 / 伏笔 / 文风」
 * 装配成一段给模型看的上下文，并满足两件事：
 * 1. 全知但标注：AI 能看到全部设定卡（只有 aiVisible 关闭的不进上下文）；
 *    revealAtChapter 没到的卡照常进上下文，只在行尾标注「（尚未揭示，第 N 章后）」，
 *    由提示词约束「知道不等于写出」，这样 AI 既不会前后矛盾，也不会提前点破。
 * 2. 预算裁剪：按 token 预算给每块打分，超预算时先丢低优先级块，再截断最长的块。
 *
 * UI 的「上下文抽屉」直接消费 ContextSectionMeta[]，做到所见即所发。
 */
import type { Chapter, Character, ContextConfig, ID, WorldSetting } from "@/lib/types";
import {
  getNovel,
  getNovelOutline,
  getNovelTree,
  getVolumeOutline,
  getBlueprint,
  listArchives,
  listCharacters,
  listWorld,
  listForeshadows,
} from "@/lib/repo";
import { estimateTokens } from "@/lib/ui/cn";

export interface ChapterRef {
  chapter: Chapter;
  volumeTitle: string;
  /** 全书 1-based 序号 */
  index: number;
}

export type ContextSectionId =
  | "instruction"
  | "style"
  | "novel-outline"
  | "volume-outline"
  | "chapter-blueprint"
  | "chapter-summaries"
  | "archives"
  | "characters"
  | "world"
  | "foreshadows"
  | "selection"
  | "mentions";

export interface ContextSectionMeta {
  id: ContextSectionId;
  label: string;
  text: string;
  tokens: number;
  included: boolean;
  truncated: boolean;
  /** 越小越先被丢弃 */
  priority: number;
}

export interface AssembledContext {
  text: string;
  sections: ContextSectionMeta[];
  tokens: number;
  budget: number;
  chapterIndex: number | null;
  dropped: ContextSectionId[];
}

export interface AssembledContextInput {
  novelId: ID;
  chapterId?: ID | null;
  config: ContextConfig;
  selection?: string;
  mentions?: { type: "character" | "world" | "chapter" | "archive" | "foreshadow"; id: ID; label: string }[];
}

export const DEFAULT_CONTEXT_BUDGET = 6000;

/** 把卷章树拍平成全书顺序的章节列表 */
export function flattenChapters(novelId: ID): ChapterRef[] {
  const tree = getNovelTree(novelId);
  if (!tree) return [];
  const result: ChapterRef[] = [];
  let index = 0;
  for (const volume of tree.volumes) {
    for (const chapter of volume.chapters) {
      index += 1;
      result.push({ chapter, volumeTitle: volume.title, index });
    }
  }
  for (const chapter of tree.looseChapters) {
    index += 1;
    result.push({ chapter, volumeTitle: "", index });
  }
  return result;
}

function preview(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function bulletList(lines: string[]): string {
  return lines.filter(Boolean).map((line) => `- ${line}`).join("\n");
}

function formatNovelOutline(novelId: ID): string {
  const outline = getNovelOutline(novelId);
  const lines: string[] = [];
  if (outline.premise) lines.push(`一句话故事：${outline.premise}`);
  if (outline.theme) lines.push(`主题：${outline.theme}`);
  if (outline.tone) lines.push(`基调：${outline.tone}`);
  if (outline.mainPlot) lines.push(`主线：${outline.mainPlot}`);
  if (outline.subplots.length) lines.push(`支线：${outline.subplots.join("；")}`);
  if (outline.characterArcs.length) {
    lines.push(`人物弧光：${outline.characterArcs.map((item) => `${item.character}→${item.arc}`).join("；")}`);
  }
  if (outline.worldRules.length) lines.push(`世界硬规则：${outline.worldRules.join("；")}`);
  if (outline.ending) lines.push(`结局构想：${outline.ending}`);
  if (outline.hooks.length) lines.push(`核心钩子：${outline.hooks.join("；")}`);
  return lines.length ? bulletList(lines) : "";
}

function formatVolumeOutline(volumeId: ID): string {
  const outline = getVolumeOutline(volumeId);
  const lines: string[] = [];
  if (outline.summary) lines.push(`本卷简介：${outline.summary}`);
  if (outline.arcGoal) lines.push(`本卷目标：${outline.arcGoal}`);
  if (outline.keyEvents.length) lines.push(`关键事件：${outline.keyEvents.join("；")}`);
  if (outline.foreshadowPlan.length) lines.push(`伏笔计划：${outline.foreshadowPlan.join("；")}`);
  return lines.length ? bulletList(lines) : "";
}

function formatBlueprint(chapterId: ID): string {
  const blueprint = getBlueprint(chapterId);
  const lines: string[] = [];
  if (blueprint.goal) lines.push(`本章目标：${blueprint.goal}`);
  if (blueprint.pov) lines.push(`视角：${blueprint.pov}`);
  if (blueprint.conflict) lines.push(`核心冲突：${blueprint.conflict}`);
  if (blueprint.emotionalArc) lines.push(`情绪曲线：${blueprint.emotionalArc}`);
  if (blueprint.plotPoints.length) lines.push(`关键节点：${blueprint.plotPoints.join("；")}`);
  if (blueprint.hooks.length) lines.push(`章末钩子：${blueprint.hooks.join("；")}`);
  if (blueprint.scenes.length) {
    const scenes = blueprint.scenes
      .map((scene, sceneIndex) => `  场景${sceneIndex + 1}「${scene.title}」${scene.summary}${scene.emotion ? `（${scene.emotion}）` : ""}`)
      .join("\n");
    lines.push(`分场计划：\n${scenes}`);
  }
  if (blueprint.notes) lines.push(`备注：${blueprint.notes}`);
  if (blueprint.targetWords) lines.push(`目标字数：${blueprint.targetWords}`);
  return lines.length ? lines.join("\n") : "";
}

function firstSentences(text: string, count: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const sentences = flat.match(/[^。！？!?…]+[。！？!?…]?/g) ?? [flat];
  return sentences.slice(0, count).join("").slice(0, 220);
}

function characterLine(
  character: Character,
  detail: "brief" | "standard" | "full",
  nameOf: (targetId: string) => string,
  note = "",
): string {
  const suffix = note ? ` ${note}` : "";
  if (detail === "brief") {
    return `- ${character.name}${character.identity ? `（${character.identity}）` : ""}：${preview(character.currentState || character.personality, 60)}${suffix}`;
  }
  const parts: string[] = [];
  if (character.identity) parts.push(character.identity);
  if (character.personality) parts.push(`性格：${preview(character.personality, 80)}`);
  if (character.currentState) parts.push(`当前：${preview(character.currentState, 100)}`);
  if (detail === "full") {
    if (character.appearance) parts.push(`外貌：${preview(character.appearance, 70)}`);
    if (character.goals) parts.push(`目标：${preview(character.goals, 80)}`);
    if (character.speechStyle) parts.push(`说话风格：${preview(character.speechStyle, 60)}`);
    if (character.secrets) parts.push(`秘密（仅作者知晓）：${preview(character.secrets, 80)}`);
    if (character.arc) parts.push(`弧光：${preview(character.arc, 80)}`);
  }
  if (character.relations.length) {
    const relations = character.relations
      .map((relation) => {
        const target = nameOf(relation.targetId) || "未知对象";
        return `${target}（${relation.relation}${relation.note ? `，${relation.note}` : ""}）`;
      })
      .join("；");
    parts.push(`关系：${relations}`);
  }
  return `- ${character.name}：${parts.join("；")}${suffix}`;
}

function worldLine(setting: WorldSetting, detail: "brief" | "standard" | "full", note = ""): string {
  const content = setting.content.replace(/\s+/g, " ").trim();
  const limit = detail === "brief" ? 60 : detail === "standard" ? 140 : 260;
  const body = content || setting.summary;
  return `- ${setting.title}：${preview(body, limit)}${note ? ` ${note}` : ""}`;
}

function buildSection(id: ContextSectionId, label: string, text: string, priority: number): ContextSectionMeta {
  const tokens = estimateTokens(text);
  return { id, label, text, tokens, included: text.trim().length > 0, truncated: false, priority };
}

/**
 * 「对 AI 可见」是唯一硬开关：关闭的卡完全不进上下文（作者明确不想让 AI 读）。
 * 其余卡全部进入上下文，保证 AI 对全书设定「全知」，避免前后矛盾。
 */
export function filterAiVisible<T extends { aiVisible: boolean }>(items: T[]): T[] {
  return items.filter((item) => item.aiVisible);
}

/**
 * 未揭示标注：卡照常进上下文，只在这条资料的行尾加一句「（尚未揭示，第 N 章后）」，
 * 提示词据此约束 AI「知道但不能写出来」。
 * - aiVisible 关闭的卡根本不会进上下文 → 不标注，返回空串；
 * - revealAtChapter 为 null（不标注）或当前没有章节上下文 → 返回空串；
 * - 当前章节已到揭示章节 → 返回空串。
 * （原 isDisclosed 的双重判断拆开：aiVisible 决定卡的去留，revealAtChapter 只决定标注。）
 */
export function disclosureNote(
  item: { aiVisible: boolean; revealAtChapter: number | null },
  chapterIndex: number | null,
): string {
  if (!item.aiVisible) return "";
  const revealAt = item.revealAtChapter;
  if (revealAt === null || chapterIndex === null || revealAt <= chapterIndex) return "";
  return `（尚未揭示，第 ${revealAt} 章后）`;
}

/**
 * 组装上下文。
 * @throws Error("作品不存在")
 */
export function assembleContext(input: AssembledContextInput): AssembledContext {
  const { novelId, chapterId, config } = input;
  const novel = getNovel(novelId);
  if (!novel) throw new Error("作品不存在");

  const chapters = flattenChapters(novelId);
  const currentRef = chapterId ? chapters.find((ref) => ref.chapter.id === chapterId) : undefined;
  const chapterIndex = currentRef ? currentRef.index : null;
  const currentChapter = currentRef?.chapter ?? null;
  const volume = currentRef
    ? (() => {
        const tree = getNovelTree(novelId);
        if (!tree) return undefined;
        return tree.volumes.find((item) => item.chapters.some((chapter) => chapter.id === currentRef.chapter.id));
      })()
    : undefined;

  const sections: ContextSectionMeta[] = [];

  // 1. 作者指令 / 文风
  if (config.customInstruction.trim()) {
    sections.push(buildSection("instruction", "作者补充指令", config.customInstruction.trim(), 4));
  }
  if (config.includeStyleGuide) {
    const styleLines: string[] = [];
    if (novel.pov) styleLines.push(`叙述视角：${novel.pov}`);
    if (novel.styleGuide) styleLines.push(`文风要求：${novel.styleGuide}`);
    if (novel.forbiddenWords.length) styleLines.push(`禁用词：${novel.forbiddenWords.join("、")}`);
    if (styleLines.length) sections.push(buildSection("style", "文风指南", bulletList(styleLines), 8));
  }

  // 2. 三级大纲
  if (config.includeNovelOutline) {
    sections.push(buildSection("novel-outline", "作品总纲", formatNovelOutline(novelId), 3));
  }
  if (config.includeVolumeOutline && volume) {
    sections.push(buildSection("volume-outline", `卷纲（${volume.title}）`, formatVolumeOutline(volume.id), 2));
  }
  if (config.includeChapterBlueprint && currentChapter) {
    sections.push(buildSection("chapter-blueprint", "本章章纲", formatBlueprint(currentChapter.id), 1));
  }

  // 3. 前文章节摘要
  if (config.includeChapterSummaries > 0 && chapterIndex !== null && chapterIndex > 1) {
    const previous = chapters.slice(0, chapterIndex - 1).slice(-config.includeChapterSummaries);
    const lines = previous.map((ref) => {
      const chapterText = config.chapterSummaryMode === "tail"
        ? firstSentences(stripTags(ref.chapter.content).slice(-320), 2)
        : ref.chapter.summary || firstSentences(stripTags(ref.chapter.content), 3);
      return `第${ref.index}章《${ref.chapter.title}》：${chapterText || "（暂无摘要）"}`;
    });
    sections.push(buildSection("chapter-summaries", "前情摘要", lines.join("\n"), 5));
  }

  // 4. 故事档案（按章抽取的事实）
  if (config.includeArchives && chapterIndex !== null) {
    const archives = listArchives(novelId)
      .filter((archive) => archive.orderIndex < chapterIndex)
      .slice(-Math.max(1, config.archiveDepth));
    const blocks = archives.map((archive) => {
      const lines: string[] = [`【第${archive.orderIndex}章《${archive.chapterTitle}》档案】`];
      if (archive.chapterSummary) lines.push(archive.chapterSummary);
      if (archive.characterStates.length) {
        lines.push(`角色状态：${archive.characterStates.map((item) => `${item.name}—${item.state}${item.changes ? `（${item.changes}）` : ""}`).join("；")}`);
      }
      if (archive.settingStates.length) {
        lines.push(`设定状态：${archive.settingStates.map((item) => `${item.title}—${item.state}`).join("；")}`);
      }
      if (archive.ledger.length) {
        lines.push(`总账：${archive.ledger.map((item) => `${item.name} ${item.delta}（结余 ${item.balance}）`).join("；")}`);
      }
      if (archive.timeline.length) {
        lines.push(`时间线：${archive.timeline.map((item) => `${item.storyTime} ${item.event}`).join("；")}`);
      }
      return lines.join("\n");
    });
    sections.push(buildSection("archives", "故事档案", blocks.join("\n\n"), 6));
  }

  // 5. 角色 / 世界观 / 伏笔（全知：只过滤「对 AI 不可见」，未揭示的卡加标注而不是丢掉）
  const characters = listCharacters(novelId);
  const nameOf = (targetId: string): string => characters.find((character) => character.id === targetId)?.name ?? "";
  if (config.includeCharacters) {
    const visible = filterAiVisible(characters)
      .slice(0, 14)
      .map((character) =>
        characterLine(character, config.characterDetail, nameOf, disclosureNote(character, chapterIndex)),
      );
    sections.push(buildSection("characters", "角色资料", visible.join("\n"), 7));
  }
  if (config.includeWorld) {
    const settings = filterAiVisible(listWorld(novelId))
      .slice(0, 16)
      .map((setting) =>
        worldLine(setting, config.characterDetail, disclosureNote(setting, chapterIndex)),
      );
    sections.push(buildSection("world", "世界观设定", settings.join("\n"), 8));
  }
  if (config.includeForeshadows) {
    const foreshadows = listForeshadows(novelId).filter((foreshadow) => foreshadow.status === "planted" || foreshadow.status === "advanced");
    const lines = foreshadows.map((foreshadow) => {
      const payoff = foreshadow.payoffChapterId ? chapters.find((ref) => ref.chapter.id === foreshadow.payoffChapterId) : undefined;
      return `- ${foreshadow.title}：${foreshadow.description}${payoff ? `（计划第${payoff.index}章回收）` : ""}［${foreshadow.status}］`;
    });
    sections.push(buildSection("foreshadows", "伏笔清单", lines.join("\n"), 9));
  }

  // 6. 选中片段 / @ 引用（最高优先级：这是用户明确要求处理的内容）
  if (config.includeSelection && input.selection?.trim()) {
    sections.push(buildSection("selection", "选中片段", input.selection.trim(), 100));
  }
  if (input.mentions?.length) {
    const mentionLines: string[] = [];
    for (const mention of input.mentions) {
      const resolved = resolveMention(mention, novelId, chapters);
      if (resolved) mentionLines.push(resolved);
    }
    if (mentionLines.length) sections.push(buildSection("mentions", "引用资料", mentionLines.join("\n"), 99));
  }

  // 预算裁剪：contextBudget 是显式的上下文预算；0 = 不限制（不裁剪）。
  // 兼容旧数据：没有 contextBudget 时回退到旧的 maxTokens，再回退到内置默认 6000。
  const configured = config.contextBudget;
  const budget = configured === 0
    ? 0
    : configured && configured > 0
      ? configured
      : config.maxTokens > 0
        ? config.maxTokens
        : DEFAULT_CONTEXT_BUDGET;
  const dropped: ContextSectionId[] = [];
  let total = sections.reduce((sum, section) => (section.included ? sum + section.tokens : sum), 0);

  if (budget > 0 && total > budget) {
    const droppable = sections
      .filter((section) => section.included && section.priority < 90)
      .sort((left, right) => left.priority - right.priority);
    for (const section of droppable) {
      if (total <= budget) break;
      section.included = false;
      total -= section.tokens;
      dropped.push(section.id);
    }
  }
  if (budget > 0 && total > budget) {
    // 仍超预算：先截断最长的块，再截断其余
    const included = sections
      .filter((section) => section.included)
      .sort((left, right) => right.tokens - left.tokens);
    for (const section of included) {
      if (total <= budget) break;
      const ratio = Math.max(0.25, (budget / Math.max(total, 1)) * 0.9);
      const limit = Math.max(120, Math.floor(section.text.length * ratio));
      if (limit < section.text.length) {
        section.text = `${section.text.slice(0, limit).trimEnd()}\n…（已按上下文预算截断）`;
        const newTokens = estimateTokens(section.text);
        total += newTokens - section.tokens;
        section.tokens = newTokens;
        section.truncated = true;
        section.included = true;
      }
    }
  }

  const includedSections = sections.filter((section) => section.included && section.text.trim());
  const headerLines: string[] = [`【作品】${novel.title}${novel.genre ? `（${novel.genre}）` : ""}`];
  if (novel.synopsis) headerLines.push(`【简介】${preview(novel.synopsis, 200)}`);
  const hasUnrevealed = includedSections.some(
    (section) =>
      (section.id === "characters" || section.id === "world") && section.text.includes("尚未揭示"),
  );
  if (hasUnrevealed) {
    headerLines.push("【资料说明】标有「尚未揭示」的设定读者还不知道：可以拿来埋伏笔、铺线索，但不要提前点破或替读者揭晓。");
  }
  if (currentChapter) {
    headerLines.push(`【当前章节】第${chapterIndex ?? "?"}章《${currentChapter.title}》${volume ? `（${volume.title}）` : ""}`);
    if (currentChapter.summary) headerLines.push(`【本章已有摘要】${currentChapter.summary}`);
  }
  const body = includedSections
    .map((section) => `【${section.label}】\n${section.text.trim()}`)
    .join("\n\n");
  const text = [headerLines.join("\n"), body].filter(Boolean).join("\n\n");

  return {
    text,
    sections,
    tokens: includedSections.reduce((sum, section) => sum + section.tokens, 0),
    budget,
    chapterIndex,
    dropped,
  };
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|blockquote|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resolveMention(
  mention: { type: "character" | "world" | "chapter" | "archive" | "foreshadow"; id: ID; label: string },
  novelId: ID,
  chapters: ChapterRef[],
): string {
  switch (mention.type) {
    case "character": {
      const character = listCharacters(novelId).find((item) => item.id === mention.id);
      if (!character) return "";
      return `- 角色「${character.name}」：${character.identity} ${preview(character.personality, 100)} ${character.currentState ? `当前：${preview(character.currentState, 100)}` : ""}`.trim();
    }
    case "world": {
      const setting = listWorld(novelId).find((item) => item.id === mention.id);
      if (!setting) return "";
      return `- 设定「${setting.title}」：${preview(setting.content || setting.summary, 200)}`;
    }
    case "chapter": {
      const ref = chapters.find((item) => item.chapter.id === mention.id);
      if (!ref) return "";
      return `- 第${ref.index}章《${ref.chapter.title}》：${ref.chapter.summary || preview(stripTags(ref.chapter.content), 200)}`;
    }
    case "archive": {
      const archive = listArchives(novelId).find((item) => item.id === mention.id);
      if (!archive) return "";
      return `- 第${archive.orderIndex}章《${archive.chapterTitle}》档案：${preview(archive.chapterSummary, 200)}`;
    }
    case "foreshadow": {
      const foreshadow = listForeshadows(novelId).find((item) => item.id === mention.id);
      if (!foreshadow) return "";
      return `- 伏笔「${foreshadow.title}」：${foreshadow.description}［${foreshadow.status}］`;
    }
    default:
      return "";
  }
}
