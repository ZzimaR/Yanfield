"use client";

import * as React from "react";
import { EditorWorkbench } from "@/components/editor/EditorWorkbench";

interface EditorPageProps {
  params: Promise<{ novelId: string }>;
}

/**
 * 写作台页面。
 * Next 15 的 params 是 Promise：客户端组件用 React.use() 解包。
 */
export default function EditorPage({ params }: EditorPageProps) {
  const { novelId } = React.use(params);
  return <EditorWorkbench key={novelId} novelId={novelId} />;
}
