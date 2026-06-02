import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Algo salió mal
              </h1>
              <p className="text-muted-foreground">
                La aplicación ha experimentado un error inesperado. Por favor, intenta recargar la página.
              </p>
            </div>
            {this.state.error && (
              <div className="p-4 bg-muted rounded-md text-left overflow-auto max-h-40">
                <code className="text-xs text-muted-foreground">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Button 
                onClick={() => window.location.reload()}
                variant="default"
              >
                Recargar página
              </Button>
              <Button 
                onClick={() => (window.location.href = '/')}
                variant="outline"
              >
                Ir al inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
