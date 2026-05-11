import Link from "next/link";
import { Workflow, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
        <Workflow className="h-10 w-10 text-muted-foreground/40" />
        <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          404
        </span>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">页面未找到</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          您访问的页面不存在或已被移动，请检查 URL 是否正确。
        </p>
      </div>
      <Button asChild variant="outline" className="gap-2">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          返回仪表盘
        </Link>
      </Button>
    </div>
  );
}
