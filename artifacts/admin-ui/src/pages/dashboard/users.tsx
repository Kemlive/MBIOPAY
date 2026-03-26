import { useState } from "react";
import { Search, UserX, UserCheck, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminUsers, useFreezeUser } from "@/hooks/use-admin-api";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  const { data: users, isLoading } = useAdminUsers();
  const freezeMutation = useFreezeUser();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users?.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleToggleFreeze = (id: string, currentlyFrozen: boolean) => {
    if (confirm(`Are you sure you want to ${currentlyFrozen ? 'unfreeze' : 'freeze'} this user?`)) {
      freezeMutation.mutate({ id, freeze: !currentlyFrozen });
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (score < 70) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-red-400 bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">User Management</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage customer accounts.</p>
        </div>
        <div className="w-full sm:w-72">
          <Input 
            placeholder="Search users..." 
            icon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-muted-foreground border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                <th className="px-6 py-4 font-medium">Risk Score</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-10 w-48 bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-5 w-24 bg-white/5 rounded animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 bg-white/5 rounded-full animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 bg-white/5 rounded-full animate-pulse" /></td>
                    <td className="px-6 py-4"><div className="h-9 w-24 ml-auto bg-white/5 rounded-lg animate-pulse" /></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No users found matching "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(user.joinedAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", getRiskColor(user.riskScore ?? 0))}>
                        <ShieldAlert className="w-3 h-3" />
                        {user.riskScore ?? 0}/100
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isFrozen ? (
                        <Badge variant="destructive">Frozen</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant={user.isFrozen ? "outline" : "destructive"} 
                        size="sm"
                        onClick={() => handleToggleFreeze(String(user.id), !!user.isFrozen)}
                        className="w-28"
                      >
                        {user.isFrozen ? (
                          <><UserCheck className="w-4 h-4 mr-2" /> Unfreeze</>
                        ) : (
                          <><UserX className="w-4 h-4 mr-2" /> Freeze</>
                        )}
                      </Button>
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
