import { Navigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth.js";
import type { ReactNode } from "react";

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps): ReactNode {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}
