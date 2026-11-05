"use client";

export type ThemeMode = "light" | "dark" | "system";
export const THEME_KEY = "yanfield:theme";

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "dark" || raw === "system" || raw === "light" ? raw : "light";
}

export function applyTheme(mode: ThemeMode, persist = true): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  if (persist) {
    try {
      window.localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* ignore */
    }
  }
}

/** 页面加载前内联执行，避免主题闪烁 */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}")||"light";var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=m==="system"?(d?"dark":"light"):m;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;
