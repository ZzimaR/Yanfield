"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Menu, X } from "lucide-react";
import { IconButton } from "@/components/ui/kit";
import { InkstoneMark } from "@/components/brand/InkstoneMark";
import { GitHubMark } from "./GitHubMark";
import { ThemeToggle } from "./ThemeToggle";
import { isPublicSite } from "@/lib/public-site";
import { GITHUB_URL, NAV_LINKS } from "./constants";

/** 落地页顶栏：logo、锚点导航、主题切换、GitHub 与主 CTA。 */
export function LandingNav() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled ? "border-line bg-paper/85 backdrop-blur-md" : "border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="砚田首页">
          <InkstoneMark className="size-9" />
          <span className="flex flex-col leading-none">
            <span className="font-serif text-[17px] tracking-[0.12em] text-ink">砚田</span>
            <span className="mt-1 text-[10px] tracking-[0.22em] text-ink-3">写长篇</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="页面导航">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-sm px-3 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm px-3 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <GitHubMark className="size-3.5" />
            源码
          </a>
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {isPublicSite ? (
            <a
              href="#how"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-medium text-accent-ink shadow-card transition-colors hover:bg-accent-hover sm:px-4"
            >
              <BookOpen className="size-3.5" aria-hidden />
              怎么开始
            </a>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/library")}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-medium text-accent-ink shadow-card transition-colors hover:bg-accent-hover sm:px-4"
            >
              <BookOpen className="size-3.5" aria-hidden />
              开始写作
            </button>
          )}
          <IconButton
            label={open ? "关闭菜单" : "打开菜单"}
            size="lg"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </IconButton>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line bg-paper/95 backdrop-blur-md md:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col px-4 py-2 sm:px-6" aria-label="移动端导航">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-sm px-2 py-2.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-sm px-2 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <GitHubMark className="size-4" />
              源码
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
