import { useState } from "react";
import { DashboardTab } from "@/components/dashboard/DashboardTab";
import { DepositTab } from "@/components/dashboard/DepositTab";
import { SendTab } from "@/components/dashboard/SendTab";
import SettingsPage from "@/pages/SettingsPage";
import { BarChart3, Download, Send, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type TabId = "dashboard" | "deposit" | "send" | "settings";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { user } = useAuth();

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "deposit",   label: "Deposit",   icon: Download },
    { id: "send",      label: "Send",      icon: Send },
    { id: "settings",  label: "Settings",  icon: Settings },
  ] as const;

  const initials = (user?.displayName || user?.username || "?")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/images/logo-icon.png"
              alt="MBIO PAY"
              className="h-9 w-9 rounded-xl object-cover shadow-lg shadow-primary/20"
            />
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-xl font-bold tracking-tight text-foreground">MBIO</span>
              <span className="font-display text-xl font-bold tracking-tight text-primary ml-1">PAY</span>
            </div>
          </div>

          {/* Right: desktop nav + avatar */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 bg-secondary/50 p-1.5 rounded-2xl border border-border/50">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm shadow-black/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <tab.icon className={cn("h-4 w-4", activeTab === tab.id && "text-primary")} />
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Avatar button → settings */}
            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "w-9 h-9 rounded-full overflow-hidden border-2 transition-all",
                activeTab === "settings" ? "border-primary" : "border-border hover:border-primary/50"
              )}
              title="Profile & Settings"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{initials}</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-10">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "deposit"   && <DepositTab />}
        {activeTab === "send"      && <SendTab />}
        {activeTab === "settings"  && <SettingsPage />}
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
              {tab.id === "settings" && user?.avatarUrl ? (
                <div className={cn(
                  "w-6 h-6 rounded-full overflow-hidden border-2",
                  activeTab === "settings" ? "border-primary" : "border-muted-foreground/40"
                )}>
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={cn("p-1.5 rounded-lg transition-colors", activeTab === tab.id ? "bg-primary/10" : "")}>
                  <tab.icon className="h-5 w-5" />
                </div>
              )}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
