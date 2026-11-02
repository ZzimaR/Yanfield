import * as React from "react";
import { Plus } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const FAQS = [
  {
    q: "我的 API Key 存在哪？会被上传吗？",
    a: "只存在你电脑本地的设置里（SQLite 的 settings 表）。请求由你的机器直接发往模型服务商，砚田没有任何中转服务器，也不会把 Key 写进日志或上报。界面上展示时会自动掩码，随时可以删除。",
  },
  {
    q: "支持哪些模型？",
    a: "任意 OpenAI 兼容接口都可以：OpenAI、DeepSeek、Moonshot、通义、智谱、vLLM、Ollama 等；另外原生支持 Anthropic 与 Gemini。对话/大纲模型与正文模型可以分开配置，在设置或 AI 面板里切换。",
  },
  {
    q: "我的书稿数据在哪？怎么备份？",
    a: "全部在本地：默认是项目下的 SQLite 文件（data/yanfield.db），复制这个文件就是完整备份。也可以把单本书导出为 Markdown / TXT，或直接对整个数据目录做 git 版本管理。",
  },
  {
    q: "能导入已有的 TXT 小说吗？",
    a: "可以。在「设置 → 数据」里选择 TXT 文件，砚田会按「第 N 章」等标题自动切分，先预览再确认入库；也可以选择作为单章导入，或指定导入到某一卷。",
  },
  {
    q: "能商用吗？",
    a: "软件本身不行。砚田采用 PolyForm Noncommercial 1.0.0：可以自己用、学习、修改和分享，不能出售，也不能放进商业产品或收费服务。你写出的小说版权归你；模型输出的使用范围以你所选模型服务商的条款为准。",
  },
  {
    q: "需要联网或注册账号吗？",
    a: "不需要注册，也不需要登录。除了调用模型 API 需要网络之外，写作、建档、大纲、导入导出全部离线可用；接本地 Ollama 甚至可以全程断网。",
  },
];

/** 常见问题：使用原生 details，无 JS 依赖。 */
export function FAQ({ compact = false }: { compact?: boolean }) {
  return (
    <section id="faq" className={compact ? "mt-12" : "mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24"}>
      <SectionHeading eyebrow="常见问题" title="你可能想问的几件事" align={compact ? "left" : "center"} />

      <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group border-b border-line last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-surface-2/60 sm:px-5 [&::-webkit-details-marker]:hidden">
              {faq.q}
              <Plus
                className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45"
                aria-hidden
              />
            </summary>
            <p className="px-4 pb-4 text-[12.5px] leading-7 text-ink-3 sm:px-5">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
