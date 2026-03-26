import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminSession } from "@/hooks/use-admin-api";

// Pages
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import OverviewPage from "@/pages/dashboard/overview";
import UsersPage from "@/pages/dashboard/users";
import OrdersPage from "@/pages/dashboard/orders";
import AnalyticsPage from "@/pages/dashboard/analytics";

const queryClient = new QueryClient();

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useAdminSession();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    // If not on login page, redirect to login
    if (location !== "/login" && location !== "/") {
      setLocation("/login");
    }
    return null;
  }

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />
      
      {/* Protected Dashboard Routes */}
      <Route path="/dashboard" component={() => <ProtectedRoute component={OverviewPage} />} />
      <Route path="/dashboard/users" component={() => <ProtectedRoute component={UsersPage} />} />
      <Route path="/dashboard/orders" component={() => <ProtectedRoute component={OrdersPage} />} />
      <Route path="/dashboard/analytics" component={() => <ProtectedRoute component={AnalyticsPage} />} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
