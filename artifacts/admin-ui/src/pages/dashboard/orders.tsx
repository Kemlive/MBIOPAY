import { useState } from "react";
import { format } from "date-fns";
import { Filter, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminOrders } from "@/hooks/use-admin-api";
import { formatCurrency } from "@/lib/utils";

export default function OrdersPage() {
  const { data: orders, isLoading } = useAdminOrders();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOrders = orders?.filter(order => 
    statusFilter === "all" || order.status === statusFilter
  ) || [];

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'processing': return <Badge variant="warning">Processing</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'waiting': return <Badge variant="default">Waiting Payment</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Order Ledger</h1>
          <p className="text-muted-foreground mt-1">Real-time view of all remittance transactions.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select 
              className="h-10 pl-9 pr-8 rounded-xl bg-input/50 border border-white/10 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="waiting">Waiting</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-muted-foreground border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium">Order ID</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium text-right">USDT In</th>
                <th className="px-6 py-4 font-medium text-right">UGX Out</th>
                <th className="px-6 py-4 font-medium">Destination</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-5 w-20 bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-24 bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-32 bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-16 ml-auto bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-24 ml-auto bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-8 w-32 bg-white/5 rounded-full animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-20 bg-white/5 rounded-full animate-pulse" /></td>
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {order.id}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(order.createdAt), "MMM d, HH:mm")}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {order.userName}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-400">
                      {formatCurrency(order.amountUsdt ?? 0, 'USDT')}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-white">
                      {formatCurrency(order.amountUgx ?? 0, 'UGX')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${order.network.toLowerCase() === 'mtn' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>
                          {order.network}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Smartphone className="w-3 h-3" />
                          {order.recipientPhone}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
