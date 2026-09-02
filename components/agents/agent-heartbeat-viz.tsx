"use client";

import { useEffect, useState } from "react";
import type { MoodState } from "@/lib/types";

interface AgentHeartbeatVizProps {
  mood: MoodState;
  energy: number;
  online: boolean;
}

const moodColors: Record<MoodState, string> = {
  focused: "var(--info)",
  alert: "var(--warning)",
  tired: "var(--muted-foreground)",
  stressed: "var(--destructive)",
  curious: "var(--viz-2)",
  satisfied: "var(--success)",
};

export function AgentHeartbeatViz({ mood, energy, online }: AgentHeartbeatVizProps) {
  const [beat, setBeat] = useState(false);

  useEffect(() => {
    if (!online) return;
    // Heartbeat speed based on energy: higher energy = faster beat
    const interval = 600 + (1 - energy) * 800;
    const timer = setInterval(() => {
      setBeat(true);
      setTimeout(() => setBeat(false), 150);
    }, interval);
    return () => clearInterval(timer);
  }, [energy, online]);

  const color = online ? moodColors[mood] : "var(--muted-foreground)";
  const scale = beat ? 1.3 : 1;
  const opacity = online ? (energy * 0.5 + 0.5) : 0.3;

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative w-6 h-6 rounded-full transition-transform duration-150"
        style={{
          backgroundColor: color,
          transform: `scale(${scale})`,
          opacity,
          boxShadow: beat ? `0 0 12px ${color}60` : "none",
        }}
      >
        {online && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: color, opacity: 0.2 }}
          />
        )}
      </div>
      <span className="text-tiny text-muted-foreground">
        {online ? "心跳" : "离线"}
      </span>
    </div>
  );
}
