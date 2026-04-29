"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { AppLoader } from "@/components/ui/app-loader";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>{children}</AuthBootstrap>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/**
 * Calls initAuth() once on mount to validate the stored token via /auth/me.
 * Renders a full-screen loader until auth resolution completes, then mounts
 * the rest of the app. This prevents any flash of unauthenticated content.
 */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((s) => s.initAuth);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!_hasHydrated) return <AppLoader />;

  return <>{children}</>;
}
