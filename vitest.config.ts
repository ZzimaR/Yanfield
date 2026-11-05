import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * 砚田单元测试配置。
 * - 只测「纯函数 + 纯数据」层（lib/ui、lib/diff、lib/editor 的文本转换），不依赖 DOM 与数据库；
 * - `@/` 别名与 tsconfig 的 `paths` 保持一致，测试里可以直接 `import { ... } from "@/lib/..."`。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  // 本项目使用 Vite 8 / Vitest 5，底层由 oxc 负责 TS/JSX 转换；
  // 根目录 tsconfig 为 Next.js 保留了 `jsx: "preserve"`，这里必须显式指定
  // automatic runtime，否则 `.tsx` 里的 JSX 会原样留给 import-analysis 而报语法错误。
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup-env.ts"],
    globals: false,
    reporters: "default",
  },
});
