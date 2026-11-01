import type { Metadata } from "next";
import { AppHome } from "@/components/home/AppHome";
import { PublicIntro } from "@/components/landing/PublicIntro";
import { isPublicSite } from "@/lib/public-site";

export const metadata: Metadata = {
  title: { absolute: isPublicSite ? "砚田 — 写在自己电脑上的小说工作台" : "砚田" },
  description: isPublicSite
    ? "砚田是装在你自己电脑上的小说工作台。这个网站只做介绍，稿子不会经过这里。"
    : "打开书架，继续写。稿子留在这台电脑上。",
};

/** 本机是写作入口。只有发布到 yanfield.com 时才换成介绍页。 */
export default function HomePage() {
  if (isPublicSite) return <PublicIntro />;
  return <AppHome />;
}
