import { extractJson } from "@/lib/ai/prompts";
import type { CharacterRole, ForeshadowStatus } from "@/lib/types";

const ROLES = new Set<CharacterRole>(["protagonist", "antagonist", "supporting", "mentor", "ensemble", "other"]);
const ROLE_ALIAS: Record<string, CharacterRole> = {
  主角: "protagonist",
  反派: "antagonist",
  配角: "supporting",
  导师: "mentor",
  群像: "ensemble",
  其他: "other",
};

const STATUSES = new Set<ForeshadowStatus>(["planted", "advanced", "paid", "dropped"]);
const STATUS_ALIAS: Record<string, ForeshadowStatus> = {
  已埋设: "planted",
  埋设: "planted",
  推进中: "advanced",
  推进: "advanced",
  已回收: "paid",
  回收: "paid",
  已放弃: "dropped",
  放弃: "dropped",
};

export interface CharacterFill {
  identity: string;
  appearance: string;
  personality: string;
  goals: string;
  secrets: string;
  arc: string;
  speechStyle: string;
  currentState: string;
}

export interface DerivedCharacter {
  name: string;
  role: CharacterRole;
  identity: string;
  personality: string;
  relation: string;
}

export interface ForeshadowFill {
  description: string;
  notes: string;
}

export interface DerivedForeshadow {
  title: string;
  description: string;
  status: ForeshadowStatus;
  notes: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function roleOf(value: unknown): CharacterRole {
  const raw = textOf(value);
  if (ROLES.has(raw as CharacterRole)) return raw as CharacterRole;
  return ROLE_ALIAS[raw] ?? "supporting";
}

function statusOf(value: unknown): ForeshadowStatus {
  const raw = textOf(value);
  if (STATUSES.has(raw as ForeshadowStatus)) return raw as ForeshadowStatus;
  return STATUS_ALIAS[raw] ?? "planted";
}

const CHARACTER_KEYS = ["identity", "appearance", "personality", "goals", "secrets", "arc", "speechStyle", "currentState"] as const;

export function parseCharacterFill(text: string): CharacterFill | null {
  const record = asRecord(extractJson<unknown>(text));
  if (!record) return null;
  const fill = {
    identity: textOf(record.identity),
    appearance: textOf(record.appearance),
    personality: textOf(record.personality),
    goals: textOf(record.goals),
    secrets: textOf(record.secrets),
    arc: textOf(record.arc),
    speechStyle: textOf(record.speechStyle),
    currentState: textOf(record.currentState),
  };
  if (CHARACTER_KEYS.every((key) => !fill[key])) return null;
  return fill;
}

export function parseDerivedCharacters(text: string): DerivedCharacter[] {
  const parsed = extractJson<unknown>(text);
  const record = asRecord(parsed);
  const list = Array.isArray(parsed) ? parsed : record && Array.isArray(record.items) ? record.items : [];
  const seen = new Set<string>();
  const result: DerivedCharacter[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const name = textOf(row.name) || textOf(row.title);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push({
      name,
      role: roleOf(row.role),
      identity: textOf(row.identity),
      personality: textOf(row.personality),
      relation: textOf(row.relation) || "相关",
    });
  }
  return result;
}

export function parseForeshadowFill(text: string): ForeshadowFill | null {
  const record = asRecord(extractJson<unknown>(text));
  if (!record) return null;
  const description = textOf(record.description);
  const notes = textOf(record.notes);
  if (!description && !notes) return null;
  return { description, notes };
}

export function parseDerivedForeshadows(text: string): DerivedForeshadow[] {
  const parsed = extractJson<unknown>(text);
  const record = asRecord(parsed);
  const list = Array.isArray(parsed) ? parsed : record && Array.isArray(record.items) ? record.items : [];
  const seen = new Set<string>();
  const result: DerivedForeshadow[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const title = textOf(row.title);
    if (!title || seen.has(title)) continue;
    seen.add(title);
    result.push({
      title,
      description: textOf(row.description),
      status: statusOf(row.status),
      notes: textOf(row.notes),
    });
  }
  return result;
}
