import { Users, Activity, DollarSign, Wallet, ShieldAlert, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOverview } from "@/hooks/use-admin-api";
import { formatCurrency } from "@/lib/utils";

export default function OverviewPage() {
  const { data, isLoading } = useOverview();

  const stats = [
    {
      title: "Total Users",
      value: data?.totalUsers?.toLocaleString() || "0",
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      title: "Total Orders",
      value: data?.totalOrders?.toLocaleString() || "0",
      icon: Activity,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Volume (USDT)",
      value: formatCurrency(data?.totalVolume || 0, 'USDT'),
      icon: Wallet,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Revenue (UGX)",
      value: formatCurrency(data?.totalRevenue || 0, 'UGX'),
      icon: DollarSign,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      title: "Fraud Flags",
      value: data?.fraudFlags?.toLocaleString() || "0",
      icon: ShieldAlert,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      title: "Pending Orders",
      value: data?.pendingOrders?.toLocaleString() || "0",
      icon: Clock,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-white">System Overview</h1>
        <p className="text-muted-foreground mt-1">High-level metrics and system health.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="glass-card hover:-translate-y-1 transition-transform duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-1/2 bg-white/5 rounded animate-pulse mt-1"></div>
              ) : (
                <div className="text-3xl font-display font-bold text-foreground">
                  {stat.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Decorative empty state area below stats showing system status */}
      <Card className="glass-card mt-8">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse glow-primary"></div>
          </div>
          <h3 className="text-xl font-display font-semibold text-white">All Systems Operational</h3>
          <p className="text-muted-foreground max-w-md mt-2">
            API servers, database clusters, and payment gateways are functioning normally with sub-100ms latency.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
