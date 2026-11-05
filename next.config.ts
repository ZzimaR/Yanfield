import type { NextConfig } from "next";

// standalone 输出（独立 server.js）只给 Docker / 打包使用，需显式 `YANFIELD_STANDALONE=1` 开启。
// 本机直接 `pnpm build && pnpm start` 用普通构建，也避免 Windows 没有符号链接权限时的 EPERM。
const pages = process.env.YANFIELD_PAGES === "1";
const standalone = !pages && process.env.YANFIELD_STANDALONE === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(pages
    ? { output: "export" as const, images: { unoptimized: true } }
    : standalone
      ? { output: "standalone" as const }
      : {}),
  // 关掉开发模式的 Next.js 悬浮小圆标（左下角 N），开发与截图都更干净。
  // 只影响 `next dev`，生产构建本来就不会出现。
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
