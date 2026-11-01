import type { NextConfig } from "next";

// Docker / 自托管部署时产出独立 server.js（默认开启）。
// Windows 上若没有创建符号链接的权限（未开「开发者模式」），next build
// 在复制 standalone 追踪文件时会报 EPERM；此时用 `YANTIAN_STANDALONE=0`
// 关闭 standalone 输出，`next start` 同样可以跑起来。
const pages = process.env.YANTIAN_PAGES === "1";
const standalone = !pages && process.env.YANTIAN_STANDALONE !== "0";

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
