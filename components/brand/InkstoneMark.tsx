import { cn } from "@/lib/ui/cn";

/** 砚台标识。图源是带笔与墨池的圆角标，透明底，浅色和夜航里都能看清。 */
export function InkstoneMark({ className }: { className?: string }) {
  return <img src="/brand-mark.png" alt="砚田" width={512} height={512} className={cn("object-contain", className)} />;
}
