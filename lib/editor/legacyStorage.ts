"use client";

/**
 * 视图偏好键的兼容迁移。
 *
 * 本项目改过品牌名：早期本地偏好写在 `mozhou:editor:*`，现在是 `yantian:editor:*`。
 * 老用户（含开发期浏览器）第一次打开新版编辑器时把旧键搬一次，避免偏好丢失。
 * 规则：只补缺失的新键，不覆盖已有新值；搬完删除旧键；隐私模式/禁用存储时静默跳过。
 */

const LEGACY_PREFIX = "mozhou:";
const CURRENT_PREFIX = "yantian:";

export function migrateLegacyEditorStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    const legacyKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
    }
    for (const key of legacyKeys) {
      const target = CURRENT_PREFIX + key.slice(LEGACY_PREFIX.length);
      const value = storage.getItem(key);
      if (value !== null && storage.getItem(target) === null) storage.setItem(target, value);
      storage.removeItem(key);
    }
  } catch {
    /* 存不了就算了，不影响写作 */
  }
}
