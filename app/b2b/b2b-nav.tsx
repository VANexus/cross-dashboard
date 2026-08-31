"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrendingUp, Package, Palette } from "lucide-react";

const TABS = [
  { href: "/b2b/keyword-trends", label: "关键词趋势", icon: TrendingUp },
  { href: "/b2b/listing", label: "一键上架", icon: Package },
  { href: "/b2b/image-skills", label: "生图 Skill 库", icon: Palette },
];

/** B端工作台三个子页共用顶部导航 */
export function B2BNav() {
  const pathname = usePathname();
  return (
    <div className="mb-5">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">B端运营工作台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            关键词趋势 · AI Listing 一键上架 · 生图 Skill 库
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-b pb-3">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-border bg-card shadow-sm text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
