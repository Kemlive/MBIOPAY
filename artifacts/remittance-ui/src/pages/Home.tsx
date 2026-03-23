import { useState } from "react";
import { DashboardTab } from "@/components/dashboard/DashboardTab";
import { DepositTab } from "@/components/dashboard/DepositTab";
import { SendTab } from "@/components/dashboard/SendTab";
import { BarChart3, Download, Send, ArrowLeftRight, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type TabId = "dashboard" | "deposit" | "send";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { user, logout } = useAuth();

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "deposit", label: "Deposit", icon: Download },
    { id: "send", label: "Send", icon: Send },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-xl font-bold tracking-tight text-foreground">MBIO</span>
              <span className="font-display text-xl font-bold tracking-tight text-primary ml-1">PAY</span>
            </div>
            <span className="hidden sm:block text-muted-foreground text-xs border-l border-border pl-3">
              Money home in minutes
            </span>
          </div>

          {/* Right side: desktop nav + user info */}
          <div className="flex items-center gap-3">
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border/50">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm shadow-black/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4", activeTab === tab.id && "text-primary")} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* User badge + logout */}
            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 bg-secondary/60 border border-border/50 rounded-xl px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                  <div className="leading-none">
                    <p className="text-xs font-semibold text-foreground">{user.username}</p>
                    <p className="text-[10px] text-muted-foreground">UID: {user.uid}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-10">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "deposit" && <DepositTab />}
        {activeTab === "send" && <SendTab />}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/40 bg-card/90 backdrop-blur-lg">
        <div className="flex justify-around items-center p-2 h-16">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full space-y-1 rounded-xl transition-colors",
                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn("p-1.5 rounded-lg transition-colors", activeTab === tab.id ? "bg-primary/10" : "")}>
                <tab.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
