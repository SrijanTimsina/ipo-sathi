import { useAuth } from "../hooks/useAuth.js";
import { Skeleton } from "#/components/ui/skeleton";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  // In Dual-Mode architecture, unauthenticated users are in "Browser Mode"
  // They have access to the app, but data is loaded from/saved to localStorage.
  return <>{children}</>;
}
