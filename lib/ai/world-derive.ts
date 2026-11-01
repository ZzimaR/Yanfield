import { extractJson } from "@/lib/ai/prompts";
import type { WorldCategory } from "@/lib/types";

const CATEGORIES = new Set<WorldCategory>(["power", "geography", "faction", "item", "rule", "history", "custom"]);

const CATEGORY_ALIAS: Record<string, WorldCategory> = {
  地理: "geography",
  地点: "geography",
  城市: "geography",
  势力: "faction",
  国家: "faction",
  组织: "faction",
  物品: "item",
  规则: "rule",
  历史: "history",
  力量: "power",
  体系: "power",
};

const NEST_RELATION = /位于|属于|下辖|境内|城中|州内|里面|辖于/;

export interface CardFill {
  summary: string;
  content: string;
}

export interface DerivedSetting {
  title: string;
  category: WorldCategory;
  summary: string;
  content: string;
  relation: string;
  /** 位于 / 属于 / 下辖 这类包含关系，挂到当前卡片下面 */
  nest: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function categoryOf(value: unknown): WorldCategory {
  const raw = textOf(value);
  if (CATEGORIES.has(raw as WorldCategory)) return raw as WorldCategory;
  return CATEGORY_ALIAS[raw] ?? "geography";
}

/** 补全当前卡片：只要摘要和正文，丢掉提问清单。 */
export function parseCardFill(text: string): CardFill | null {
  const parsed = extractJson<unknown>(text);
  const record = asRecord(parsed);
  if (!record) return null;
  const summary = textOf(record.summary);
  const content = textOf(record.content);
  if (!summary && !content) return null;
  return { summary, content };
}

/** 衍生相关设定：每条独立，包含关系才挂到当前卡片下。 */
export function parseDerivedSettings(text: string): DerivedSetting[] {
  const parsed = extractJson<unknown>(text);
  const record = asRecord(parsed);
  const list = Array.isArray(parsed) ? parsed : record && Array.isArray(record.items) ? record.items : [];
  const seen = new Set<string>();
  const result: DerivedSetting[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const title = textOf(row.title);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    const relation = textOf(row.relation) || "相关";
    const nest = row.nest === true || NEST_RELATION.test(relation);
    result.push({
      title,
      category: categoryOf(row.category),
      summary: textOf(row.summary),
      content: textOf(row.content),
      relation,
      nest,
    });
  }
  return result;
}
