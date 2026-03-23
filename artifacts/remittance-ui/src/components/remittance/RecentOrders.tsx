import { formatDistanceToNow } from "date-fns";
import { Activity, ArrowUpRight, CheckCircle2, Clock, XCircle, TimerOff } from "lucide-react";
import { useGetRecentOrders } from "@workspace/api-client-react";
import { formatPhone } from "@/lib/utils";

export function RecentOrders() {
  const { data: orders, isLoading } = useGetRecentOrders({
    query: { refetchInterval: 10000 } // Refetch every 10s
  });

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center p-8">
        <Activity className="w-6 h-6 text-muted-foreground animate-pulse" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-12 mb-8">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Live Network Activity
        </h3>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
        </span>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const isCompleted = order.status === "completed";
          const isFailed = order.status === "failed";
          const isExpired = order.status === "expired";

          return (
            <div 
              key={order.id} 
              className="flex items-center justify-between p-4 rounded-xl bg-card/40 border border-white/5 backdrop-blur-sm hover:bg-card/80 transition-all duration-200"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${
                  isCompleted ? "bg-primary/20 text-primary" : 
                  isFailed ? "bg-destructive/20 text-destructive" : 
                  isExpired ? "bg-secondary text-muted-foreground" :
                  "bg-warning/20 text-warning"
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                   isFailed ? <XCircle className="w-5 h-5" /> : 
                   isExpired ? <TimerOff className="w-5 h-5" /> :
                   <Clock className="w-5 h-5" />}
                </div>
                
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    {formatPhone(order.phone)}
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-secondary text-secondary-foreground">
                      {order.network}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>

              <div className="text-right">
                {order.amount ? (
                  <>
                    <div className="font-bold text-foreground flex items-center justify-end gap-1">
                      {order.amount} USDT <ArrowUpRight className="w-3 h-3 text-primary" />
                    </div>
                    {order.ugxAmount && (
                      <div className="text-xs text-primary mt-1">
                        ≈ {order.ugxAmount.toLocaleString()} UGX
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground italic">Pending deposit</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
