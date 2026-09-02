"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, MessageSquare } from "lucide-react";
import type { AgentConfig } from "@/lib/types";

interface AgentPersonaCardProps {
  config: AgentConfig;
}

export function AgentPersonaCard({ config }: AgentPersonaCardProps) {
  const persona = config?.persona;

  if (!persona) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            人格设定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">未配置人格信息</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          人格设定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {persona.systemPrompt}
        </p>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">沟通风格:</span>
          <Badge variant="secondary" className="text-tiny">{persona.communicationStyle}</Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {(persona.expertise ?? []).map((tag) => (
            <Badge key={tag} variant="outline" className="text-tiny border-primary/20 text-primary/80">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
