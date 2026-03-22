import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border",
        {
          "bg-primary/10 text-primary border-primary/20": variant === "default",
          "bg-secondary text-secondary-foreground border-transparent": variant === "secondary",
          "text-foreground border-border": variant === "outline",
          "bg-success/10 text-success border-success/20": variant === "success",
          "bg-warning/10 text-warning border-warning/20": variant === "warning",
          "bg-destructive/10 text-destructive border-destructive/20": variant === "destructive",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
