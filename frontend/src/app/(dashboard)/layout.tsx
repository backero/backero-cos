"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import type { Module } from "@/types";

const ROUTE_MODULE: Record<string, Module> = {
  "/dashboard":  "dashboard",
  "/tasks":      "tasks",
  "/finance":    "finance",
  "/inventory":  "inventory",
  "/employees":  "employees",
  "/production": "production",
  "/reports":    "reports",
  "/roles":      "roles",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, canView } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  // Derive which module the current path requires
  const requiredModule = Object.entries(ROUTE_MODULE).find(([route]) =>
    pathname === route || pathname.startsWith(route + "/")
  )?.[1];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (requiredModule && !canView(requiredModule)) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, requiredModule, canView, router]);

  if (!isAuthenticated) return null;
  if (requiredModule && !canView(requiredModule)) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <AppSidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
