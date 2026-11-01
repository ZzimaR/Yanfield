import type { Metadata } from "next";
import { BibleWorkspace } from "@/components/cards/BibleWorkspace";

export const metadata: Metadata = {
  title: "设定",
  description: "角色、世界观与伏笔的统一资料库",
};

export default async function BiblePage({
  params,
  searchParams,
}: {
  params: Promise<{ novelId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { novelId } = await params;
  const { tab } = await searchParams;
  const initialTab = Array.isArray(tab) ? tab[0] : tab;
  return <BibleWorkspace novelId={novelId} initialTab={initialTab} />;
}
