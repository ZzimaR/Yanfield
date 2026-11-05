import { describe, expect, it, vi } from "vitest";
import { createEditorSaveGuard, isSaveShortcut, navigateAfterSaving } from "@/lib/editor/navigation";
import { createSaveQueue } from "@/lib/editor/save-queue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("章节保存队列", () => {
  it("并发保存会等待保存过程中新增的修改", async () => {
    const pending = ["第一次"];
    const saved: string[] = [];
    const firstSave = deferred();
    const secondSave = deferred();
    const flush = createSaveQueue(
      () => pending.length > 0,
      async () => {
        const next = pending.shift();
        if (!next) throw new Error("没有待保存内容");
        saved.push(next);
        await (next === "第一次" ? firstSave.promise : secondSave.promise);
      },
    );

    const first = flush();
    pending.push("保存期间的新修改");
    const second = flush();
    const finished = vi.fn();
    void second.then(finished);

    firstSave.resolve();
    await vi.waitFor(() => expect(saved).toEqual(["第一次", "保存期间的新修改"]));
    expect(finished).not.toHaveBeenCalled();

    secondSave.resolve();
    await Promise.all([first, second]);
    expect(finished).toHaveBeenCalledOnce();
  });

  it("保存失败会向调用方报错，之后可以重试", async () => {
    let pending = true;
    let fail = true;
    const flush = createSaveQueue(
      () => pending,
      async () => {
        if (fail) throw new Error("磁盘不可写");
        pending = false;
      },
    );

    await expect(flush()).rejects.toThrow("磁盘不可写");
    fail = false;
    await expect(flush()).resolves.toBeUndefined();
    expect(pending).toBe(false);
  });
});

describe("离开编辑器前保存", () => {
  it("识别保存快捷键，但不拦截其他组合或输入法", () => {
    const event = {
      key: "s", code: "KeyS", ctrlKey: true, metaKey: false, altKey: false,
      shiftKey: false, isComposing: false, defaultPrevented: false,
    };
    expect(isSaveShortcut(event)).toBe(true);
    expect(isSaveShortcut({ ...event, ctrlKey: false, metaKey: true })).toBe(true);
    expect(isSaveShortcut({ ...event, key: "ы" })).toBe(true);
    expect(isSaveShortcut({ ...event, ctrlKey: false })).toBe(false);
    expect(isSaveShortcut({ ...event, shiftKey: true })).toBe(false);
    expect(isSaveShortcut({ ...event, altKey: true })).toBe(false);
    expect(isSaveShortcut({ ...event, isComposing: true })).toBe(false);
    expect(isSaveShortcut({ ...event, defaultPrevented: true })).toBe(false);
  });

  it("等待保存完成后才导航", async () => {
    const guard = createEditorSaveGuard();
    const saving = deferred();
    const navigate = vi.fn();
    guard.register(() => saving.promise);

    const operation = navigateAfterSaving(guard.flush, navigate);
    expect(navigate).not.toHaveBeenCalled();
    saving.resolve();
    await operation;
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("保存失败时不导航，旧编辑器卸载也不会移除新注册的保存函数", async () => {
    const guard = createEditorSaveGuard();
    const unregisterOld = guard.register(async () => {});
    const unregisterCurrent = guard.register(async () => {
      throw new Error("保存失败");
    });
    unregisterOld();
    const navigate = vi.fn();

    await expect(navigateAfterSaving(guard.flush, navigate)).rejects.toThrow("保存失败");
    expect(navigate).not.toHaveBeenCalled();

    unregisterCurrent();
    await navigateAfterSaving(guard.flush, navigate);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("跨编辑器实例按章节串行写入，旧写入失败也不阻塞新写入", async () => {
    const guard = createEditorSaveGuard();
    const hold = deferred();
    const order: string[] = [];
    const first = guard.runExclusive("chapter-a", async () => {
      order.push("旧写入");
      await hold.promise;
      throw new Error("旧写入失败");
    }).catch((error: unknown) => error);
    const second = guard.runExclusive("chapter-a", async () => {
      order.push("新写入");
    });
    await guard.runExclusive("chapter-b", async () => {
      order.push("其他章节");
    });

    expect(order).toEqual(["旧写入", "其他章节"]);
    hold.resolve();
    expect(await first).toEqual(new Error("旧写入失败"));
    await second;
    expect(order).toEqual(["旧写入", "其他章节", "新写入"]);
  });
});
