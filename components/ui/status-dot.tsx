import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "danger" | "idle" | "info";

const variantClasses: Record<StatusVariant, string> = {
  success: "bg-success status-glow-success",
  warning: "bg-warning status-glow-warning",
  danger: "bg-destructive status-glow-danger",
  idle: "bg-muted-foreground/40",
  info: "bg-info",
};

interface StatusDotProps {
  status: StatusVariant;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = { sm: "h-1.5 w-1.5", md: "h-2 w-2", lg: "h-2.5 w-2.5" };

export function StatusDot({ status, pulse = false, size = "md", className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0",
        sizeMap[size],
        variantClasses[status],
        pulse && "animate-pulse-glow",
        className
      )}
    />
  );
}
