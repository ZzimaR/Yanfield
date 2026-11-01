import * as React from "react";
import Link from "next/link";
import { InkstoneMark } from "@/components/brand/InkstoneMark";
import { GitHubMark } from "./GitHubMark";
import { DOCS_URL, GITHUB_URL, ISSUES_URL, VERSION } from "./constants";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "产品",
    links: [
      { label: "功能", href: "#features" },
      { label: "工作原理", href: "#how" },
      { label: "路线图", href: "#roadmap" },
      { label: "常见问题", href: "#faq" },
    ],
  },
  {
    title: "资源",
    links: [
      { label: "源码仓库", href: GITHUB_URL, external: true },
      { label: "文档", href: DOCS_URL, external: true },
      { label: "问题反馈", href: ISSUES_URL, external: true },
      { label: "版本发布", href: `${GITHUB_URL}/releases`, external: true },
    ],
  },
  {
    title: "关于",
    links: [
      { label: "不可商用许可证", href: `${GITHUB_URL}/blob/master/LICENSE`, external: true },
      { label: "贡献指南", href: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`, external: true },
      { label: "致谢", href: "#why" },
    ],
  },
];

/** 首页页脚。 */
export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-surface-2/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <InkstoneMark className="size-9" />
              <span className="flex flex-col leading-none">
                <span className="font-serif text-[17px] tracking-[0.12em] text-ink">砚田</span>
                <span className="mt-1 text-[10px] tracking-[0.22em] text-ink-3">写长篇</span>
              </span>
            </Link>
            <p className="mt-3.5 max-w-xs text-[12px] leading-6 text-ink-3">
              写长篇用的本地工作台。稿子留在自己电脑里，故事只属于你。
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors hover:text-accent"
            >
              <GitHubMark className="size-3.5" />
              ZzimaR/Yanfield
            </a>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12.5px] text-ink-2 transition-colors hover:text-accent"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a href={link.href} className="text-[12.5px] text-ink-2 transition-colors hover:text-accent">
                        {link.label}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-5 text-[11.5px] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 砚田 · 源码公开，不可商用 · {VERSION}</span>
          <span>写给愿意自己保管稿子的人</span>
        </div>
      </div>
    </footer>
  );
}
