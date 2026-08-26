"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Search, ImageIcon, Target, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiLivePanelProps {
  /** 由页头「发起编排」按钮递增触发重跑 */
  runSignal: number;
}

interface StepState {
  name: string;
  icon: React.ReactNode;
  state: "done" | "running" | "pending";
}

const STEP_DEFS: Array<{ name: string; icon: React.ReactNode }> = [
  { name: "选品分析", icon: <Search className="ic" /> },
  { name: "AI 作图", icon: <ImageIcon className="ic" /> },
  { name: "广告优化", icon: <Target className="ic" /> },
  { name: "Listing 上架", icon: <Package className="ic" /> },
];

const LINES: Array<[string, string]> = [
  ["14:32:01", "哨兵Agent · 触发编排：车载保温杯 · 北美站"],
  ["14:32:18", "调度Agent · 拆解 DAG → 4 节点，分配 3 个执行体"],
  ["14:32:40", "选品Agent · 抓取 128 条竞品评论，识别痛点「单手开盖」「异味」"],
  ["14:33:05", "作图Agent · 生成 6 张场景图，评分 top-1 为「通勤 · 暖调」"],
  ["14:33:29", "广告Agent · 关键词「commuter flask」出价 0.42，预计 ACOS 31%…"],
];

const DONE_LINE: [string, string] = ["14:34:02", "编排完成 · 4 节点全部成功，成果已写入内容库"];

interface StreamLine {
  t: string;
  text: string;
  cursor: boolean;
}

export function AiLivePanel({ runSignal }: AiLivePanelProps) {
  const [stepStates, setStepStates] = useState<StepState["state"][]>(["pending", "pending", "running", "pending"]);
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [typing, setTyping] = useState(true);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // 流式状态放 ref，避免 setState 函数式更新器与闭包计数器的竞态
  const linesRef = useRef<StreamLine[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (runSignal < 1) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    let li = 0;
    let ci = 0;
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.current = timers.current.filter((t) => t !== id);
        fn();
      }, ms);
      timers.current.push(id);
    };

    const commitLines = () => setLines(linesRef.current.slice());

    const typeLine = () => {
      if (li >= LINES.length) {
        setStepStates(["done", "done", "done", "done"]);
        setProgress(100);
        linesRef.current = [...linesRef.current, { t: DONE_LINE[0], text: DONE_LINE[1], cursor: false }];
        commitLines();
        setTyping(false);
        return;
      }
      const [t, full] = LINES[li];
      if (ci === 0) {
        setStepStates((s) => s.map((st, i) => (i === li ? "done" : i === li + 1 ? "running" : st)));
      }
      if (ci <= full.length) {
        const partial = full.slice(0, ci);
        const next = linesRef.current.slice();
        if (ci === 0) next.push({ t, text: partial, cursor: true });
        else if (next.length > 0) next[next.length - 1] = { t, text: partial, cursor: true };
        linesRef.current = next;
        commitLines();
        ci += 1;
        setProgress(Math.min(95, ((li + ci / full.length) / LINES.length) * 100));
        schedule(typeLine, 14);
      } else {
        const next = linesRef.current.slice();
        if (next.length > 0) next[next.length - 1] = { ...next[next.length - 1], cursor: false };
        linesRef.current = next;
        commitLines();
        li += 1;
        ci = 0;
        schedule(typeLine, 240);
      }
    };

    // 首个 tick 做「重置 + 开跑」：setState 都在回调内，避免 effect 内同步 setState
    schedule(() => {
      linesRef.current = [];
      setLines([]);
      setProgress(0);
      setTyping(true);
      setStepStates(["pending", "pending", "running", "pending"]);
      typeLine();
    }, 50);
  }, [runSignal]);

  return (
    <div className="glass dash-panel dash-ai-live">
      <div className="dash-ai-live-head">
        <span className="dash-ai-title">
          <Sparkles className="spark" />
          AI 编排 · 选品 → 作图 → 广告 → 上架
        </span>
        <span className="dash-ai-tag dash-step running">
          <span className="dash-dot ok" /> 运行中
        </span>
      </div>

      <div className="dash-steps">
        {STEP_DEFS.map((s, i) => (
          <span key={s.name} className={cn("dash-step", stepStates[i])}>
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {s.icon}
            </svg>
            {s.name}
          </span>
        ))}
      </div>

      <div className="dash-stream">
        {lines.length === 0 && typing && (
          <span className="ln">
            <span className="t">准备中</span>
            <span className="cursor" />
          </span>
        )}
        {lines.map((l, i) => (
          <div key={i} className="ln">
            <span className="t">{l.t}</span>
            <span>
              {l.text}
              {l.cursor && <span className="cursor" />}
            </span>
          </div>
        ))}
      </div>

      <div className="dash-progress">
        <i style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
