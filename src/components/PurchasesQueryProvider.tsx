import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const purchasesQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function PurchasesQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={purchasesQueryClient}>
      {children}
    </QueryClientProvider>
  );
}
