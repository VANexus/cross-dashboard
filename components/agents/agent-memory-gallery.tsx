"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";
import type { MemoryEntry } from "@/lib/types";

interface AgentMemoryGalleryProps {
  memories: MemoryEntry[];
}

const typeColors: Record<string, string> = {
  script: "text-blue-500 bg-blue-500/10",
  insight: "text-purple-500 bg-purple-500/10",
  preference: "text-amber-500 bg-amber-500/10",
  fact: "text-emerald-500 bg-emerald-500/10",
};

export function AgentMemoryGallery({ memories }: AgentMemoryGalleryProps) {
  if (memories.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          记忆沉淀
          <Badge variant="secondary" className="text-[10px] ml-auto">{memories.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 grid-cols-2">
          {memories.map((mem) => (
            <div key={mem.id} className="p-2 rounded-lg border bg-muted/30 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium truncate">{mem.title}</p>
                <Badge variant="outline" className={`text-[10px] border-0 shrink-0 ${typeColors[mem.type] ?? "text-muted-foreground bg-muted"}`}>
                  {mem.type}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-2">{mem.content}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
