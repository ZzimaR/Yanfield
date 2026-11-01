/** 静态资源与样式模块声明（Next 会在 next build/dev 时生成 next-env.d.ts，这里保证 tsc --noEmit 独立可用） */
declare module "*.css";
declare module "*.scss";
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";
declare module "*.webp";
declare module "*.ico";
