"use client";

/**
 * 角色编辑 Sheet
 * 编辑：GET/PATCH /api/characters/[id]；新建：POST /api/characters；删除：DELETE /api/characters/[id]
 * AI 补全：POST /api/ai/task（feature: character-card）
 */
import * as React from "react";
import { Sparkles, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Dropdown,
  Input,
  Select,
  Sheet,
  Switch,
  useToast,
} from "@/components/ui/kit";
import { FloatWindow } from "@/components/editor/FloatWindow";
import { CHARACTER_HANDOFF_TASKS, handToAssistant } from "@/lib/editor/hand-off";
import { ModelKeyHint } from "@/components/ai/ModelKeyHint";
import { AiTextField, TagsInput, stripChapterNumber, unwrapEntity, useErrorToast } from "@/components/outline/form-kit";
import { labeledDraft } from "@/lib/ai/assist-brief";
import { parseCharacterFill } from "@/lib/ai/card-derive";
import { apiDelete, apiPatch, apiPost, notifyDataChanged, streamAiTask, useApi } from "@/lib/client/api";
import type { AiStreamEvent, Character, CharacterRelation } from "@/lib/types";
import { CHARACTER_ROLE_LABEL } from "@/lib/types";
import { RelationsEditor } from "./RelationsEditor";

interface CharacterDraft {
  name: string;
  aliases: string[];
  role: Character["role"];
  gender: string;
  age: string;
  identity: string;
  appearance: string;
  personality: string;
  goals: string;
  secrets: string;
  arc: string;
  speechStyle: string;
  currentState: string;
  relations: CharacterRelation[];
  aiVisible: boolean;
  revealAtChapter: number | null;
  tags: string[];
  pinned: boolean;
}

function emptyDraft(): CharacterDraft {
  return {
    name: "",
    aliases: [],
    role: "supporting",
    gender: "",
    age: "",
    identity: "",
    appearance: "",
    personality: "",
    goals: "",
    secrets: "",
    arc: "",
    speechStyle: "",
    currentState: "",
    relations: [],
    aiVisible: true,
    revealAtChapter: null,
    tags: [],
    pinned: false,
  };
}

function toDraft(character: Character): CharacterDraft {
  return {
    name: character.name,
    aliases: [...character.aliases],
    role: character.role,
    gender: character.gender,
    age: character.age,
    identity: character.identity,
    appearance: character.appearance,
    personality: character.personality,
    goals: character.goals,
    secrets: character.secrets,
    arc: character.arc,
    speechStyle: character.speechStyle,
    currentState: character.currentState,
    relations: character.relations.map((relation) => ({ ...relation })),
    aiVisible: character.aiVisible,
    revealAtChapter: character.revealAtChapter,
    tags: [...character.tags],
    pinned: character.pinned,
  };
}

/** 编辑区统一的分组卡片 */
function EditorSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface-2/60 p-3.5">
      <div className="mb-3">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{hint}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function CharacterEditor({
  open,
  novelId,
  character,
  characters,
  chapters,
  onClose,
  onSaved,
  onDeleted,
  presentation = "sheet",
}: {
  open: boolean;
  novelId: string;
  character: Character | null;
  characters: Character[];
  chapters: { id: string; orderIndex: number; title: string }[];
  onClose: () => void;
  onSaved: (saved: Character) => void;
  onDeleted: () => void;
  /** 写作台里用可拖动的窗口，不盖成整页。 */
  presentation?: "sheet" | "float";
}) {
  const { toast } = useToast();
  const editing = Boolean(character);
  const detailApi = useApi<Character>(open && character ? `/api/characters/${character.id}` : null);
  const [draft, setDraft] = React.useState<CharacterDraft>(() => (character ? toDraft(character) : emptyDraft()));
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [filling, setFilling] = React.useState(false);
  const [savedId, setSavedId] = React.useState<string | null>(character?.id ?? null);
  const [minimized, setMinimized] = React.useState(false);
  const nextFloatKey = open ? (character?.id ?? "new") : "closed";
  const [floatKey, setFloatKey] = React.useState(nextFloatKey);
  if (floatKey !== nextFloatKey) {
    setFloatKey(nextFloatKey);
    if (open) setMinimized(false);
  }
  const initKey = `${open ? 1 : 0}:${character?.id ?? "new"}:${detailApi.data?.updatedAt ?? ""}`;
  const lastInitKey = React.useRef("");

  useErrorToast(detailApi.error, "角色详情加载失败");

  const source = character ? detailApi.data && detailApi.data.id === character.id ? detailApi.data : character : null;

  React.useEffect(() => {
    if (lastInitKey.current === initKey) return;
    lastInitKey.current = initKey;
    if (!open) return;
    setSavedId(source?.id ?? null);
    setDraft(source ? toDraft(source) : emptyDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initKey, open]);

  const update = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const name = draft.name.trim();
    if (!name) {
      toast({ title: "请先填写角色名", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...draft, name };
      const saved = savedId
        ? await apiPatch<Character>(`/api/characters/${savedId}`, payload)
        : await apiPost<Character>(`/api/characters`, { novelId, ...payload });
      const entity = unwrapEntity(saved);
      setSavedId(entity.id);
      onSaved(entity);
      notifyDataChanged("characters");
      toast({ title: editing ? "角色已保存" : "已新建角色", description: name, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "保存角色失败", description: err instanceof Error ? err.message : String(err), tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!character) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/characters/${character.id}`);
      setConfirmDeleteOpen(false);
      onDeleted();
      notifyDataChanged("characters");
      toast({ title: "角色已删除", description: character.name, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "删除角色失败", description: err instanceof Error ? err.message : String(err), tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const fillCard = () => {
    setFilling(true);
    let text = "";
    void streamAiTask(
      {
        novelId,
        feature: "character-card",
        message: ["这是补全当前角色卡。", labeledDraft([
          { label: "姓名", value: draft.name },
          { label: "身份", value: draft.identity },
          { label: "外貌", value: draft.appearance },
          { label: "性格", value: draft.personality },
          { label: "目标", value: draft.goals },
          { label: "秘密", value: draft.secrets },
          { label: "成长弧", value: draft.arc },
          { label: "说话风格", value: draft.speechStyle },
          { label: "当前状态", value: draft.currentState },
        ])].filter(Boolean).join("\n\n"),
        instruction:
          "这是补全当前角色卡。只输出 JSON：{\"identity\":\"\",\"appearance\":\"\",\"personality\":\"\",\"goals\":\"\",\"secrets\":\"\",\"arc\":\"\",\"speechStyle\":\"\",\"currentState\":\"\"}。只写这一个人，不要改姓名，不要提问。",
      },
      {
        onEvent: (event: AiStreamEvent) => {
          if (event.type === "delta") text += event.text;
        },
      },
    )
      .then(() => {
        const fill = parseCharacterFill(text);
        if (!fill) {
          toast({ title: "没有填进卡片", description: "生成结果不是这张角色卡的字段。", tone: "error" });
          return;
        }
        setDraft((prev) => ({
          ...prev,
          identity: fill.identity || prev.identity,
          appearance: fill.appearance || prev.appearance,
          personality: fill.personality || prev.personality,
          goals: fill.goals || prev.goals,
          secrets: fill.secrets || prev.secrets,
          arc: fill.arc || prev.arc,
          speechStyle: fill.speechStyle || prev.speechStyle,
          currentState: fill.currentState || prev.currentState,
        }));
        toast({ title: "已填入当前卡片", description: "还没保存。确认后点保存才会写入。", tone: "success" });
      })
      .catch((err: unknown) => {
        toast({ title: "补全失败", description: err instanceof Error ? err.message : "请稍后再试", tone: "error" });
      })
      .finally(() => setFilling(false));
  };

  const relationLine = draft.relations
    .map((relation) => {
      const target = characters.find((item) => item.id === relation.targetId)?.name ?? "";
      const relationText = [relation.relation.trim(), relation.note.trim()].filter(Boolean).join("，");
      return [target, relationText].filter(Boolean).join("：");
    })
    .filter(Boolean)
    .join("；");
  const material = [
    draft.name.trim() ? `姓名：${draft.name.trim()}` : "",
    draft.identity.trim() ? `身份：${draft.identity.trim()}` : "",
    draft.personality.trim() ? `性格：${draft.personality.trim()}` : "",
    draft.currentState.trim() ? `当前状态：${draft.currentState.trim()}` : "",
    relationLine ? `关系：${relationLine}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const giveToAssistant = (task: (typeof CHARACTER_HANDOFF_TASKS)[number]) => {
    const label = draft.name.trim() || "新角色";
    handToAssistant({
      reference: savedId ? { type: "character", id: savedId, label } : null,
      taskId: task.id,
      taskLabel: `${task.label} · ${label}`,
      prompt: material ? `${task.prompt}\n\n【当前材料】\n${material}` : task.prompt,
    });
    if (presentation === "float") setMinimized(true);
  };

  const chapterOptions = [
    { value: "", label: "立即揭示（一直可见）" },
    ...chapters.map((chapter) => ({
      value: String(chapter.orderIndex + 1),
      label: `第 ${chapter.orderIndex + 1} 章 · ${stripChapterNumber(chapter.title)}`,
    })),
  ];

  const displayName = draft.name.trim() || "未命名角色";
  const initial = displayName.slice(0, 1);
  const subtitle = [CHARACTER_ROLE_LABEL[draft.role], draft.identity].filter(Boolean).join(" · ");

  const footer = (
    <div className="flex items-center gap-2 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
      {editing ? (
        <Button variant="danger" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDeleteOpen(true)}>
          删除
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" size="sm" loading={saving} onClick={save}>
          {savedId ? "保存" : "创建角色"}
        </Button>
      </div>
    </div>
  );

  const body = (
    <>
      <div className="space-y-3.5 p-4 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
        {/* 概览条：角色名 / 定位 + AI 补全入口 */}
        <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-[16px] font-semibold text-accent"
              aria-hidden
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{displayName}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{subtitle || "还没有填写身份"}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-accent hover:bg-accent-soft"
              icon={<Sparkles className="size-3.5" />}
              loading={filling}
              onClick={fillCard}
            >
              补全这张卡
            </Button>
            {presentation === "float" ? (
              <Dropdown
                trigger={
                  <Button variant="ghost" size="sm">
                    交给助手
                  </Button>
                }
                items={CHARACTER_HANDOFF_TASKS.map((task) => ({
                  label: task.label,
                  onSelect: () => giveToAssistant(task),
                }))}
              />
            ) : null}
          </div>
        </div>

        {presentation === "float" ? (
          <p className="text-[12px] leading-5 text-ink-3">交给助手会把这张卡和任务填进右侧输入框，你改完再发送。</p>
        ) : (
          <ol className="space-y-1.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-[12px] leading-5 text-ink-2">
            <li>1. 先写姓名。已有的身份、性格可以留下，AI 会顺着你写过的事实补。</li>
            <li>2. 「补全这张卡」只改这个人的身份、外貌、性格这些栏，不改姓名，也不会自动保存。看完点底部「{savedId ? "保存" : "创建角色"}」。</li>
            <li>3. 这段话里如果还有别人，在写作台把这张卡交给右侧助手。这里只改这个人。</li>
            <li>字段旁边的「AI 帮我写」只改那一个框，和上面的按钮不是一回事。</li>
          </ol>
        )}
        <ModelKeyHint />

        <EditorSection title="基本信息" hint="先定称呼与身份，AI 写作时会按这个口径称呼角色。">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="姓名" value={draft.name} placeholder="角色的常用称呼" onChange={(event) => update("name", event.target.value)} />
            <Select
              label="定位"
              value={draft.role}
              onChange={(event) => update("role", event.target.value as Character["role"])}
              options={Object.entries(CHARACTER_ROLE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <TagsInput label="别名" value={draft.aliases} onChange={(aliases) => update("aliases", aliases)} placeholder="称号、化名、外号，回车或逗号分隔" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="性别" value={draft.gender} placeholder="可留空" onChange={(event) => update("gender", event.target.value)} />
            <Input label="年龄" value={draft.age} placeholder="如：二十七 / 不详" onChange={(event) => update("age", event.target.value)} />
          </div>
          <Input label="身份" value={draft.identity} placeholder="身份、职业、所属势力" onChange={(event) => update("identity", event.target.value)} />
        </EditorSection>

        <EditorSection title="外在" hint="外貌与说话风格，是 AI 写对白与动作的第一依据。">
          <AiTextField
            label="外貌"
            field="角色外貌"
            feature="character-card"
            novelId={novelId}
            value={draft.appearance}
            onChange={(value) => update("appearance", value)}
            rows={2}
            placeholder="体貌、衣着、标志性细节"
          />
          <AiTextField
            label="说话风格"
            field="角色说话风格"
            feature="character-card"
            novelId={novelId}
            value={draft.speechStyle}
            onChange={(value) => update("speechStyle", value)}
            rows={2}
            placeholder="句长、口癖、称呼习惯，最好举例"
          />
        </EditorSection>

        <EditorSection title="内在" hint="动机、秘密与成长弧决定这个人在压力下会怎么选。">
          <AiTextField
            label="性格与行事逻辑"
            field="角色性格与行事逻辑"
            feature="character-card"
            novelId={novelId}
            value={draft.personality}
            onChange={(value) => update("personality", value)}
            rows={3}
            placeholder="他遇到压力时的第一反应是什么"
          />
          <AiTextField
            label="目标"
            field="角色目标"
            feature="character-card"
            novelId={novelId}
            value={draft.goals}
            onChange={(value) => update("goals", value)}
            rows={2}
            placeholder="想要什么，愿意付出什么代价"
          />
          <AiTextField
            label="秘密"
            field="角色秘密"
            feature="character-card"
            novelId={novelId}
            value={draft.secrets}
            onChange={(value) => update("secrets", value)}
            rows={2}
            placeholder="读者暂时不知道、但会影响行为的事"
          />
          <AiTextField
            label="成长弧"
            field="角色成长弧"
            feature="character-card"
            novelId={novelId}
            value={draft.arc}
            onChange={(value) => update("arc", value)}
            rows={2}
            placeholder="从…变成…，转折点是什么"
          />
        </EditorSection>

        <EditorSection title="当前状态" hint="最近一章结束时的处境；故事档案会自动更新这里。">
          <AiTextField
            label="当前状态"
            field="角色当前状态"
            feature="character-card"
            novelId={novelId}
            value={draft.currentState}
            onChange={(value) => update("currentState", value)}
            rows={2}
            placeholder="位置 / 伤势 / 心态 / 手上的东西"
          />
        </EditorSection>

        <EditorSection title="关系" hint="关系会影响 AI 写人物互动时的称呼、态度与站队。">
          <RelationsEditor
            relations={draft.relations}
            characters={characters}
            selfId={character?.id}
            title={null}
            onChange={(relations) => update("relations", relations)}
          />
        </EditorSection>

        <EditorSection title="标签" hint="用于筛选与速查，不进入正文。">
          <TagsInput value={draft.tags} onChange={(tags) => update("tags", tags)} placeholder="如：守夜人、剑客、关键人物" />
        </EditorSection>

        <EditorSection title="AI 可见性" hint="控制 AI 能看到什么、什么时候看到，避免提前剧透。">
          <Switch
            checked={draft.aiVisible}
            onChange={(checked) => update("aiVisible", checked)}
            label="对 AI 可见"
            hint="关闭后，AI 写作时看不到这个角色。"
          />
          <Select
            label="揭示时机"
            value={draft.revealAtChapter === null ? "" : String(draft.revealAtChapter)}
            onChange={(event) => update("revealAtChapter", event.target.value === "" ? null : Number(event.target.value))}
            options={chapterOptions}
            hint="到指定章之前，AI 不会看到这条角色信息。"
          />
          <Switch checked={draft.pinned} onChange={(checked) => update("pinned", checked)} label="置顶" hint="置顶角色排在设定列表最前。" />
        </EditorSection>

        {detailApi.loading ? <p className="text-[11px] text-ink-3">正在获取角色最新详情…</p> : null}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="删除这个角色？"
        description={`「${character?.name ?? ""}」的角色卡会被删除，相关章节不会回滚，此操作不可撤销。`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </>
  );

  if (presentation === "float") {
    return (
      <FloatWindow
        open={open}
        title={editing ? "编辑角色" : "新角色"}
        minimized={minimized}
        onMinimizedChange={setMinimized}
        onClose={onClose}
        className={confirmDeleteOpen ? "z-40" : undefined}
        footer={footer}
      >
        {body}
      </FloatWindow>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "编辑角色" : "新建角色"} width={700} footer={footer}>
      {body}
    </Sheet>
  );
}
