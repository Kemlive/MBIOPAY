import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  isLoading?: boolean;
  highlight?: boolean;
}

export function StatCard({ title, value, subtitle, icon, isLoading, highlight }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden group", highlight && "border-primary/30 glow-primary")}>
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
      )}
      <div className="absolute -right-6 -top-6 text-white/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
        {icon}
      </div>
      
      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn("p-2 rounded-xl", highlight ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
            {icon}
          </div>
        </div>
        
        <div className="mt-4">
          {isLoading ? (
            <div className="h-8 w-1/2 bg-secondary rounded animate-pulse" />
          ) : (
            <h3 className={cn("text-3xl font-display font-bold", highlight && "glow-text")}>{value}</h3>
          )}
          {subtitle && (
             <p className="text-xs text-muted-foreground mt-2 font-medium">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
