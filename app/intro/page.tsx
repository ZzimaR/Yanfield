import type { Metadata } from "next";
import { PublicIntro } from "@/components/landing/PublicIntro";

export const metadata: Metadata = {
  title: { absolute: "砚田 — 介绍" },
  description: "给 yanfield.com 用的介绍页预览。写作台仍然从首页进入。",
};

/** 本地预览公开介绍页，不替代首页。 */
export default function IntroPreviewPage() {
  return <PublicIntro />;
}
