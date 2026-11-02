import type { Metadata } from "next";
import { AppHome } from "@/components/home/AppHome";
import { PublicIntro } from "@/components/landing/PublicIntro";
import { isPublicSite } from "@/lib/public-site";

export const metadata: Metadata = {
  title: { absolute: isPublicSite ? "砚田 — 故事归你，写作也由你做主" : "砚田" },
  description: isPublicSite
    ? "免费自托管的 AI 小说工作台。书稿本地保存，自带 API，正文与资料的每次修改由你确认。非商业用途免费，模型服务费用另计。"
    : "打开书架，继续写。稿子留在这台电脑上。",
};

/** 本机是写作入口。只有发布到 yanfield.com 时才换成介绍页。 */
export default function HomePage() {
  if (isPublicSite) return <PublicIntro />;
  return <AppHome />;
}
