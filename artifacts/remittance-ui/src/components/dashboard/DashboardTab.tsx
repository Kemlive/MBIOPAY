import { useGetWalletBalance, useGetStats, useGetRecentOrders } from "@workspace/api-client-react";
import { StatCard } from "./StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Wallet, ArrowDownToLine, RefreshCw, ArrowUpRight, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export function DashboardTab() {
  const { data: balance, isLoading: isBalanceLoading, refetch: refetchBalance, isRefetching: isBalanceRefetching } = useGetWalletBalance();
  const { data: stats, isLoading: isStatsLoading, refetch: refetchStats, isRefetching: isStatsRefetching } = useGetStats();
  const { data: recentOrders, isLoading: isOrdersLoading, refetch: refetchOrders, isRefetching: isOrdersRefetching } = useGetRecentOrders();

  const handleRefresh = () => {
    refetchBalance();
    refetchStats();
    refetchOrders();
  };

  const isRefreshing = isBalanceRefetching || isStatsRefetching || isOrdersRefetching;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="success">Completed</Badge>;
      case "processing": return <Badge variant="default" className="animate-pulse">Processing</Badge>;
      case "waiting": return <Badge variant="warning">Waiting Deposit</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Overview</h2>
          <p className="text-muted-foreground mt-1">Live metrics and recent activity</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title="USDT Balance"
          value={`${formatNumber(balance?.usdtBalance ?? 0, 2)} ₮`}
          subtitle="Available in wallet"
          icon={<Wallet className="h-6 w-6" />}
          isLoading={isBalanceLoading}
          highlight
        />
        <StatCard
          title="UGX Equivalent"
          value={formatCurrency(balance?.ugxEquivalent ?? 0)}
          subtitle={`Rate: 1 ₮ = ${formatNumber(balance?.usdtRate ?? 3700, 0)} UGX`}
          icon={<Activity className="h-6 w-6" />}
          isLoading={isBalanceLoading}
        />
        <StatCard
          title="Total Payouts"
          value={formatCurrency(stats?.totalUgxPaidOut ?? 0)}
          subtitle={`${stats?.completedOrders ?? 0} completed transfers`}
          icon={<ArrowDownToLine className="h-6 w-6" />}
          isLoading={isStatsLoading}
        />
        <StatCard
          title="Pending Deposits"
          value={stats?.pendingOrders ?? 0}
          subtitle="Awaiting user action"
          icon={<Clock className="h-6 w-6" />}
          isLoading={isStatsLoading}
        />
      </div>

      <Card className="mt-8 border-white/5">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Recent Transfers
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isOrdersLoading ? (
            <div className="p-8 flex justify-center">
              <span className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recentOrders && recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30">
                  <tr>
                    <th className="px-6 py-4 font-medium">Order ID</th>
                    <th className="px-6 py-4 font-medium">Recipient</th>
                    <th className="px-6 py-4 font-medium">Amount Received</th>
                    <th className="px-6 py-4 font-medium">UGX Sent</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 font-mono">#{order.id.toString().padStart(5, '0')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.phone}</span>
                          <Badge variant="outline" className="text-[10px] bg-secondary border-none">{order.network}</Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-emerald-400">
                        {order.amount ? `${formatNumber(order.amount)} ₮` : '-'}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {order.ugxAmount ? formatCurrency(order.ugxAmount) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground whitespace-nowrap">
                        {format(new Date(order.createdAt), "MMM d, HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                <Clock className="h-8 w-8" />
              </div>
              <p className="text-foreground font-medium">No recent orders found</p>
              <p className="text-sm text-muted-foreground mt-1">When users make transfers, they will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
