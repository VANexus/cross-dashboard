"use client";

// ⌘K 命令面板 — shadcn command（cmdk）重写版。
// 索引全部由注册表派生：workspace registry（页面）+ journey registry（发起旅程）+ AI 动作，
// 新增空间/旅程自动出现在面板，本文件零改动。
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Route, CirclePlay } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { getAllEntries } from "@/lib/workspaces/registry";
import { journeys } from "@/lib/journeys/registry";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 唤起 AI 助手的回调 */
  onInvokeAI?: () => void;
}

export function CommandPalette({ open, onOpenChange, onInvokeAI }: CommandPaletteProps) {
  const router = useRouter();

  // 页面索引：按空间分组（含 hidden 入口）
  const pageGroups = useMemo(() => {
    const acc = new Map<string, ReturnType<typeof getAllEntries>>();
    for (const e of getAllEntries()) {
      const list = acc.get(e.workspaceLabel) ?? [];
      list.push(e);
      acc.set(e.workspaceLabel, list);
    }
    return [...acc.entries()];
  }, []);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog
      title="命令面板"
      description="搜索页面、旅程、Agent 动作…"
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-lg"
    >
      {/* cmdk 根上下文：ui/command 的 CommandDialog 不内置 Command，须显式包裹 */}
      <Command className="[&_[cmdk-group-heading]]:text-muted-foreground">
        <CommandInput placeholder="搜索页面、旅程、Agent..." />
        <CommandList>
          <CommandEmpty>无匹配结果</CommandEmpty>

        {/* AI 快捷入口 — 始终在顶部 */}
        {onInvokeAI && (
          <CommandGroup heading="AI 助手">
            <CommandItem onSelect={() => run(() => onInvokeAI())}>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <MessageSquare className="h-4 w-4" />
              </span>
              询问 AI 助手
              <CommandShortcut>⌘⇧A</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {/* 发起旅程 — journey registry 派生 */}
        <CommandGroup heading="发起旅程">
          <CommandItem
            value="编排中心 journeys 流程"
            onSelect={() => run(() => router.push("/journeys"))}
          >
            <Route className="h-4 w-4 text-primary" />
            流程编排中心
          </CommandItem>
          {journeys
            .filter((j) => j.enabled)
            .map((j) => {
              const Icon = j.icon;
              return (
                <CommandItem
                  key={j.id}
                  value={`${j.label} ${j.id} 旅程`}
                  onSelect={() => run(() => router.push(`/journeys/${j.id}`))}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {j.label}
                  <span className="text-xs text-muted-foreground">· {j.steps.length} 步</span>
                  <CirclePlay className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                </CommandItem>
              );
            })}
        </CommandGroup>

        <CommandSeparator />

        {/* 页面导航 — workspace registry 派生 */}
        {pageGroups.map(([wsLabel, entries]) => (
          <CommandGroup key={wsLabel} heading={wsLabel}>
            {entries.map((e) => {
              const Icon = e.icon;
              return (
                <CommandItem
                  key={e.href}
                  value={`${e.label} ${e.href}`}
                  onSelect={() => run(() => router.push(e.href))}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {e.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
