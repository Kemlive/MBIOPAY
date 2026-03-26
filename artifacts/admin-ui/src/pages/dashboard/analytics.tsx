import { Globe, Users, Link as LinkIcon, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalytics } from "@/hooks/use-admin-api";

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  const stats = [
    { title: "Total Visits", value: data?.totalVisits?.toLocaleString(), icon: Globe, color: "text-blue-400" },
    { title: "Unique IPs", value: data?.uniqueIps?.toLocaleString(), icon: MapPin, color: "text-indigo-400" },
    { title: "Email Leads", value: data?.totalLeads?.toLocaleString(), icon: Users, color: "text-emerald-400" },
    { title: "Referrals", value: data?.totalReferrals?.toLocaleString(), icon: LinkIcon, color: "text-amber-400" },
  ];

  // Calculate max count for the bar chart scaling
  const maxCountryCount = data?.topCountries?.reduce((max, c) => Math.max(max, c.count), 0) || 1;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-white">Traffic Analytics</h1>
        <p className="text-muted-foreground mt-1">Insights driven by MongoDB tracking data.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
              {isLoading ? (
                <div className="h-8 w-24 bg-white/5 rounded animate-pulse mt-1"></div>
              ) : (
                <h3 className="text-2xl font-display font-bold text-foreground mt-1">
                  {stat.value || "0"}
                </h3>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Top Countries (Bar Chart)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({length: 5}).map((_, i) => (
                  <div key={i} className="h-8 bg-white/5 rounded animate-pulse w-full"></div>
                ))}
              </div>
            ) : data?.topCountries && data.topCountries.length > 0 ? (
              <div className="space-y-5">
                {data.topCountries.map((item, i) => {
                  const percentage = (item.count / maxCountryCount) * 100;
                  return (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-foreground">{item.country}</span>
                        <span className="text-muted-foreground">{item.count.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-emerald-300 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No geographical data available yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Traffic Distribution List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Region Code</th>
                    <th className="px-4 py-3 font-medium text-right">Visitors</th>
                    <th className="px-4 py-3 font-medium text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center">Loading...</td></tr>
                  ) : data?.topCountries?.map((item, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium">{item.country}</td>
                      <td className="px-4 py-3 text-right">{item.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {(data?.totalVisits ?? 0) > 0 ? ((item.count / (data?.totalVisits ?? 1)) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
