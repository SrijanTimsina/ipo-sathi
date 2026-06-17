import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "#/components/ui/button";
import type { ReactNode } from "react";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

// Alert component isn't in our installed list — use a simple div
export function ErrorMessage({ title = "Error", message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 max-w-md w-full text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h3 className="font-semibold text-lg text-destructive">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
