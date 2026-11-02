import type { Metadata } from "next";
import { PublicIntro } from "@/components/landing/PublicIntro";

export const metadata: Metadata = {
  title: { absolute: "砚田 — 故事归你，写作也由你做主" },
  description: "本地保存，自带 API，免费自托管。让 AI 动手改稿，让每一次取舍留在你手里。",
};

/** 本地预览公开介绍页，不替代首页。 */
export default function IntroPreviewPage() {
  return <PublicIntro />;
}
