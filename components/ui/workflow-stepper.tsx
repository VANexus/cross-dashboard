"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

export interface StepItem {
  id: string;
  label: string;
  description?: string;
  status: "pending" | "active" | "completed" | "error";
}

interface WorkflowStepperProps {
  steps: StepItem[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
  orientation?: "vertical" | "horizontal";
  compact?: boolean;
  /** 允许点击任意步骤跳转（默认只允许点击已完成步骤） */
  navigable?: boolean;
  className?: string;
}

function StepIcon({ status }: { status: StepItem["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case "active":
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    case "error":
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/40" />;
  }
}

export function WorkflowStepper({
  steps,
  currentStep,
  onStepClick,
  orientation = "vertical",
  compact = false,
  navigable = false,
  className,
}: WorkflowStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {steps.map((step, i) => {
          const isActive = step.id === currentStep;
          const isCompleted = i < currentIndex;
          return (
            <button
              key={step.id}
              onClick={() => (navigable || step.status === "completed") && onStepClick?.(step.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                isActive && "bg-primary/10 text-primary font-medium",
                isCompleted && "text-muted-foreground hover:text-foreground cursor-pointer",
                !isActive && !isCompleted && (navigable ? "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer" : "text-muted-foreground/50")
              )}
            >
              <StepIcon status={isCompleted ? "completed" : isActive ? "active" : "pending"} />
              <span className="hidden sm:inline">{step.label}</span>
              {i < steps.length - 1 && (
                <div className={cn("w-8 h-px mx-1", isCompleted ? "bg-success/40" : "bg-border")} />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav className={cn("flex flex-col", className)}>
      {steps.map((step, i) => {
        const isActive = step.id === currentStep;
        const isCompleted = i < currentIndex;
        const isClickable = isCompleted && onStepClick;

        return (
          <div key={step.id} className="relative">
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "absolute left-[13px] top-8 w-px h-[calc(100%-16px)]",
                  isCompleted ? "bg-success/40" : "bg-border"
                )}
              />
            )}
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex items-start gap-3 w-full text-left p-2 rounded-lg transition-colors",
                isActive && "bg-primary/5",
                isClickable && "hover:bg-muted cursor-pointer",
                !isActive && !isClickable && "opacity-60"
              )}
            >
              <div className="mt-0.5 shrink-0">
                <StepIcon status={isCompleted ? "completed" : isActive ? "active" : step.status === "error" ? "error" : "pending"} />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm leading-5",
                    isActive ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {compact ? step.label : step.label}
                </p>
                {step.description && !compact && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{step.description}</p>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
