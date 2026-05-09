import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "danger" | "idle" | "info";

const variantClasses: Record<StatusVariant, string> = {
  success: "bg-emerald-500 status-glow-success",
  warning: "bg-amber-500 status-glow-warning",
  danger: "bg-red-500 status-glow-danger",
  idle: "bg-zinc-500",
  info: "bg-indigo-500",
};

interface StatusDotProps {
  status: StatusVariant;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusDot({ status, pulse = false, size = "md", className }: StatusDotProps) {
  const sizeClasses = { sm: "h-1.5 w-1.5", md: "h-2 w-2", lg: "h-3 w-3" };
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        sizeClasses[size],
        variantClasses[status],
        pulse && "animate-pulse-glow",
        className
      )}
    />
  );
}
