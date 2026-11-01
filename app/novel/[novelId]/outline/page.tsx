import type { Metadata } from "next";
import { OutlineWorkspace } from "@/components/outline/OutlineWorkspace";

export const metadata: Metadata = {
  title: "大纲",
  description: "小说总纲、分卷卷纲与逐章章纲",
};

export default async function OutlinePage({
  params,
  searchParams,
}: {
  params: Promise<{ novelId: string }>;
  searchParams: Promise<{ chapter?: string | string[] }>;
}) {
  const { novelId } = await params;
  const { chapter } = await searchParams;
  const chapterId = Array.isArray(chapter) ? (chapter[0] ?? null) : (chapter ?? null);
  return <OutlineWorkspace novelId={novelId} initialChapterId={chapterId} />;
}
