import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/kit";
import SettingsDialogHost from "@/components/settings/SettingsDialogHost";
import { EditorSaveGuardProvider } from "@/lib/editor/navigation";
import { THEME_SCRIPT } from "@/lib/ui/theme";

export const metadata: Metadata = {
  title: {
    default: "砚田 Yanfield — 本地优先的 AI 小说创作工作台",
    template: "%s · 砚田",
  },
  description:
    "砚田是一款源码公开、不可商用的 AI 小说创作工作台：三栏沉浸写作、多智能体协作、三级大纲、故事档案与上下文装配，全部数据保存在本地。支持接入任意 OpenAI 兼容 / Anthropic / Gemini / Ollama 模型。",
  keywords: ["AI 写作", "小说创作", "源码公开", "本地优先", "Tiptap", "Next.js", "砚田", "Yanfield"],
  applicationName: "砚田 Yanfield",
  authors: [{ name: "Zzima", url: "https://github.com/ZzimaR" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand-mark.png", type: "image/png" },
    ],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/brand-mark.png" }],
  },
  openGraph: {
    title: "砚田 Yanfield — 本地优先的 AI 小说创作工作台",
    description: "三栏沉浸写作 · 多智能体协作 · 三级大纲 · 故事档案 · 上下文装配。源码公开、不可商用、数据留在本地。",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#121316" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-paper font-ui text-ink antialiased">
        <ToastProvider>
          <EditorSaveGuardProvider>
            {children}
            {process.env.NEXT_PUBLIC_PUBLIC_SITE === "1" ? null : <SettingsDialogHost />}
          </EditorSaveGuardProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
