import type { Metadata } from "next";
import { ArchivesWorkspace } from "@/components/archives/ArchivesWorkspace";

export const metadata: Metadata = {
  title: "故事档案",
  description: "逐章记录人物状态、设定变动、账目与时间线，保证长篇连续性",
};

export default async function ArchivesPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  return <ArchivesWorkspace novelId={novelId} />;
}
