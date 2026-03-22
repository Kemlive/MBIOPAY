import { useState } from "react";
import { DashboardTab } from "@/components/dashboard/DashboardTab";
import { DepositTab } from "@/components/dashboard/DepositTab";
import { SendTab } from "@/components/dashboard/SendTab";
import { BarChart3, Download, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "dashboard" | "deposit" | "send";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "deposit", label: "Deposit", icon: Download },
    { id: "send", label: "Send Payout", icon: Send },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="font-display font-bold text-xl text-primary-foreground tracking-tighter">C2M</span>
            </div>
            <h1 className="font-display text-xl font-bold tracking-tight">Crypto Remit</h1>
          </div>
          
          <div className="hidden md:flex items-center gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-12">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "deposit" && <DepositTab />}
        {activeTab === "send" && <SendTab />}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/40 bg-card/80 backdrop-blur-lg pb-safe">
        <div className="flex justify-around items-center p-2 h-16">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 rounded-xl transition-colors",
                activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                activeTab === tab.id ? "bg-primary/10" : ""
              )}>
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
