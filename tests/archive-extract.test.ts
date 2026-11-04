import { describe, expect, it } from "vitest";
import { archiveLengthRules, archiveOutputBudget, mergeManualArchive, type ArchivePayload } from "@/lib/ai/archive-extract";

const empty: ArchivePayload = {
  chapterSummary: "",
  characterStates: [],
  settingStates: [],
  ledger: [],
  timeline: [],
  foreshadows: [],
  conflicts: [],
};

describe("archiveOutputBudget", () => {
  it("uses a roomy default when the model declares nothing", () => {
    expect(archiveOutputBudget(undefined)).toBe(4096);
    expect(archiveOutputBudget(undefined, 1)).toBe(8192);
  });

  it("never exceeds the declared model limit", () => {
    expect(archiveOutputBudget(4096)).toBe(4096);
    expect(archiveOutputBudget(4096, 1)).toBe(4096);
    expect(archiveOutputBudget(65536, 1)).toBe(8192);
  });

  it("uses the configured single-output limit when set", () => {
    expect(archiveOutputBudget(undefined, 0, 2048)).toBe(2048);
    expect(archiveOutputBudget(4096, 1, 12000)).toBe(4096);
  });

  it("asks for a tighter archive on retry", () => {
    expect(archiveLengthRules(true)).toContain("最多 6 条");
    expect(archiveLengthRules(false)).toContain("最多 12 条");
  });
});

describe("mergeManualArchive", () => {
  const manual: ArchivePayload = {
    ...empty,
    chapterSummary: "周晚拿到两封信。",
    characterStates: [{ name: "周晚", state: "手里有两封信", changes: "" }],
    ledger: [{ name: "信", delta: "+2", balance: "2", note: "作者校订" }],
  };

  it("keeps the author's entries even if the model rewrote them", () => {
    const extracted: ArchivePayload = {
      ...empty,
      chapterSummary: "周晚拿到一封信。",
      characterStates: [{ name: "周晚", state: "手里有一封信", changes: "开始登记" }],
      ledger: [{ name: "信", delta: "+1", balance: "1", note: "" }],
    };
    const { payload } = mergeManualArchive(manual, extracted);
    expect(payload.chapterSummary).toBe("周晚拿到两封信。");
    expect(payload.characterStates).toEqual([{ name: "周晚", state: "手里有两封信", changes: "开始登记" }]);
    expect(payload.ledger).toEqual([{ name: "信", delta: "+2", balance: "2", note: "作者校订" }]);
  });

  it("restores author entries the model dropped and appends new facts", () => {
    const extracted: ArchivePayload = {
      ...empty,
      characterStates: [{ name: "小满", state: "在对岸等", changes: "" }],
    };
    const { payload } = mergeManualArchive(manual, extracted);
    expect(payload.characterStates.map((item) => item.name)).toEqual(["周晚", "小满"]);
    expect(payload.ledger).toHaveLength(1);
  });

  it("counts only newly added conflicts", () => {
    const withConflict = { ...manual, conflicts: [{ topic: "旧冲突", detail: "", status: "pending" as const }] };
    const extracted: ArchivePayload = {
      ...empty,
      conflicts: [
        { topic: "旧冲突", detail: "重复", status: "pending" },
        { topic: "档案与正文不一致：信的数量", detail: "正文写的是一封", status: "pending" },
      ],
    };
    const { payload, newConflicts } = mergeManualArchive(withConflict, extracted);
    expect(newConflicts).toBe(1);
    expect(payload.conflicts).toHaveLength(2);
    expect(payload.conflicts[0].detail).toBe("重复");
  });
});
