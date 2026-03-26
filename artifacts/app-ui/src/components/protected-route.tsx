import { useLocation } from "wouter";
import { useEffect } from "react";
import { useUser } from "@/hooks/use-auth";
import { Activity } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useUser();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!isLoading && (!token || !user)) {
      setLocation('/auth');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <Activity className="w-6 h-6 text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
