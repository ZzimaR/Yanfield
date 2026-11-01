/** 落地页共享文案常量：外链统一在此维护，方便后续替换为真实仓库地址。 */
export const GITHUB_URL = "https://github.com/ZzimaR/Yanfield";
export const DOCS_URL = `${GITHUB_URL}/tree/main/docs`;
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const VERSION = "v0.1.0";
export const DEV_URL = "http://127.0.0.1:3000";

export const NAV_LINKS = [
  { href: "#features", label: "功能" },
  { href: "#how", label: "工作原理" },
  { href: "#roadmap", label: "路线图" },
  { href: "#faq", label: "常见问题" },
] as const;
