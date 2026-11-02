"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Minus, X } from "lucide-react";
import { IconButton } from "@/components/ui/kit";
import { cn } from "@/lib/ui/cn";

/** 浮窗与视口边缘的最小间距 */
const VIEWPORT_MARGIN = 8;

/** 按当前视口夹取浮窗位置，避免窄屏 / 缩放后窗口跑出屏幕（拖动越界也会在 resize 时被拉回） */
function clampToViewport(next: { x: number; y: number }, node: HTMLElement | null): { x: number; y: number } {
  if (typeof window === "undefined") return next;
  const width = node?.offsetWidth || Math.min(560, window.innerWidth - 24);
  const height = node?.offsetHeight || 0;
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, next.x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, next.y), maxY),
  };
}

/** SSR 安全的 layout effect：服务端没有布局阶段，退化为 useEffect */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * 可拖动浮窗。
 *
 * - 窄屏（<768）抽屉打开时层级必须高于 kit Overlay 的 z-50，否则浮窗会被遮罩盖住；
 *   桌面端保持 z-40，仍低于 Dialog / ConfirmDialog（z-50），删除确认等弹窗不会被浮窗挡住。
 * - keepMounted：页签被切走（面板隐藏但编辑会话没结束）时只隐藏不卸载，草稿不丢；
 *   显式关闭编辑器时传 false，浮窗卸载，重开是干净状态。
 */
export function FloatWindow({
  open,
  title,
  minimized,
  onMinimizedChange,
  onClose,
  children,
  footer,
  className,
  keepMounted = false,
}: {
  open: boolean;
  title: string;
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 追加样式（字符串末尾合并，可覆盖默认层级等工具类） */
  className?: string;
  /**
   * 首次打开之后，open=false 时是否保持挂载（只 hidden 隐藏）。
   * 用于「页签切走但编辑会话仍在」的场景；显式关闭传 false，好让子编辑器卸载重置。
   */
  keepMounted?: boolean;
}) {
  const [pos, setPos] = React.useState({ x: 292, y: 76 });
  /** 首次打开后记录，供 keepMounted 判断；最小化时 open 仍为 true，不依赖它 */
  const [hasOpened, setHasOpened] = React.useState(open);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{ pointerX: number; pointerY: number; originX: number; originY: number } | null>(null);

  const mounted = open || (keepMounted && hasOpened);

  React.useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  const clampNow = React.useCallback(() => {
    setPos((prev) => {
      const next = clampToViewport(prev, rootRef.current);
      // 位置没变时返回原对象，避免多余渲染
      return next.x === prev.x && next.y === prev.y ? prev : next;
    });
  }, []);

  // 挂载 / 展开 / 最小化变化后夹回视口（layout 阶段执行，不会闪到屏幕外）
  useIsomorphicLayoutEffect(() => {
    if (open) clampNow();
  }, [open, minimized, clampNow]);

  // 视口尺寸变化后重新夹取
  React.useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", clampNow);
    return () => window.removeEventListener("resize", clampNow);
  }, [open, clampNow]);

  // 内容异步加载导致尺寸变化时同步夹取
  React.useEffect(() => {
    const node = rootRef.current;
    if (!open || !node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(clampNow);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, clampNow]);

  if (!mounted || typeof document === "undefined") return null;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // 标题栏里的按钮 / 链接自己处理点击，不能被拖动逻辑吞掉
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, [role="button"], a')) return;
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, originX: pos.x, originY: pos.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPos({
      x: Math.max(VIEWPORT_MARGIN, drag.originX + event.clientX - drag.pointerX),
      y: Math.max(VIEWPORT_MARGIN, drag.originY + event.clientY - drag.pointerY),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label={title}
      aria-hidden={open ? undefined : true}
      className={cn(
        "fixed z-[60] flex w-[min(560px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-float md:z-40",
        minimized ? "h-auto" : "max-h-[min(760px,calc(100vh-96px))]",
        !open && "hidden",
        className,
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-line px-3 py-2 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{title}</p>
        <span className="shrink-0 text-[11px] text-ink-4">{minimized ? "已最小化" : "拖动"}</span>
        <IconButton label={minimized ? "展开" : "最小化"} size="sm" onClick={() => onMinimizedChange(!minimized)}>
          <Minus className="size-3.5" />
        </IconButton>
        <IconButton label="关闭" size="sm" onClick={onClose}>
          <X className="size-3.5" />
        </IconButton>
      </div>
      {/* 最小化时只隐藏内容，保持子组件挂载，展开后未保存的草稿仍在 */}
      <div className={cn("flex min-h-0 flex-1 flex-col", minimized && "hidden")}>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-line px-3 py-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
