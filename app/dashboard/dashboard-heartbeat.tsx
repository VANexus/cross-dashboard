"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

/** /api/dashboard/activity 返回的真实 Agent 活动 */
interface HeartbeatAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  mood?: string;
  energy?: number;
  uptimeSec: number;
  heartbeatAgeSec: number | null;
  journalCount1h: number;
  activityBuckets: number[];
}

function dotClass(status: string): string {
  if (status === "online") return "dash-dot ok";
  if (status === "busy") return "dash-dot warn";
  if (status === "error") return "dash-dot danger";
  return "dash-dot idle";
}

function ageLabel(sec: number | null): string {
  if (sec === null) return "未心跳";
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m 前`;
  return `${Math.floor(sec / 3600)}h 前`;
}

const MOOD_META: Record<string, { label: string; emoji: string }> = {
  focused: { label: "专注", emoji: "🎯" },
  curious: { label: "好奇", emoji: "🔍" },
  satisfied: { label: "满意", emoji: "😌" },
  alert: { label: "警觉", emoji: "⚡" },
  tired: { label: "疲惫", emoji: "🌙" },
  stressed: { label: "高压", emoji: "🔥" },
};

function maxBucket(b: number[]): number {
  return Math.max(1, ...b);
}

/** Agent 心跳：全部真实数据（journal 活动分桶 + 心跳年龄 + 情绪 + uptime），10s 自动刷新。 */
export function DashboardHeartbeat() {
  const [agents, setAgents] = useState<HeartbeatAgent[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/activity", { cache: "no-store" });
      const json = (await res.json()) as { success: boolean; data?: { agents: HeartbeatAgent[]; fetchedAt: string } };
      if (json.success && json.data) {
        setAgents(json.data.agents);
        setLastUpdate(json.data.fetchedAt);
      }
    } catch {
      /* 服务瞬断时保留上次数据 */
    }
  }, []);

  useEffect(() => {
    // 首拉 + 10s 轮询；setTimeout 包裹避免 effect 内同步 setState（lint 约束）
    const t0 = window.setTimeout(load, 0);
    const t = window.setInterval(load, 10_000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [load]);

  const sorted = [...agents].sort((a, b) => (b.journalCount1h || 0) - (a.journalCount1h || 0));
  const busyCount = agents.filter((a) => a.status === "busy").length;

  return (
    <div className="glass dash-panel" data-animate="panel" suppressHydrationWarning>
      <div className="dash-panel-head">
        <span className="dash-panel-title">
          <Activity className="h-4 w-4" /> Agent 心跳
          {busyCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
              {busyCount} 执行中
            </span>
          )}
          {lastUpdate && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground/60">
              <Radio className="h-3 w-3 animate-pulse" /> 实时 · {new Date(lastUpdate).toLocaleTimeString("zh-CN", { hour12: false })}
            </span>
          )}
        </span>
      </div>
      <div>
        {sorted.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">正在读取真实心跳数据…</p>
        )}
        {sorted.map((a) => {
          const mood = MOOD_META[a.mood ?? ""];
          const max = maxBucket(a.activityBuckets);
          const online = a.status === "online" || a.status === "busy";
          const busy = a.status === "busy";
          return (
            <div key={a.id} className={cn("dash-hb-row", busy && "bg-warning/5")} title={`${a.name} · ${a.type}`}>
              <span className={dotClass(a.status)} />
              <span className="dash-hb-name">{a.name}</span>
              <span className="dash-hb-bars">
                {a.activityBuckets.map((h, j) => (
                  <i
                    key={j}
                    style={{ height: `${Math.max(3, Math.round((h / max) * 18))}px` }}
                    className={cn(
                      h === 0 && "opacity-15",
                      !online && "opacity-30",
                      busy && "bg-warning",
                    )}
                  />
                ))}
              </span>
              <span className="flex flex-col items-end gap-0.5">
                {busy ? (
                  <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                    执行中
                  </span>
                ) : (
                  <span className="dash-hb-val">
                    {mood ? `${mood.emoji}${mood.label}` : "—"}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[9px] text-muted-foreground/70">
                  <Clock3 className="h-2.5 w-2.5" />
                  {ageLabel(a.heartbeatAgeSec)} · {a.journalCount1h} 活动
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
