"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tasks",
  "/finance": "Finance",
  "/inventory": "Inventory",
  "/employees": "Employees",
  "/production": "Production",
  "/reports": "Reports",
};

export function AppHeader() {
  const pathname = usePathname();
  const { toggleSidebar, notificationCount } = useUIStore();
  const { user } = useAuthStore();

  const title = PAGE_TITLES[pathname] ?? "Backero COS";

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-foreground text-lg leading-tight">{title}</h1>
          <p className="text-muted-foreground text-xs capitalize">
            {user?.role} · {user?.designation ?? ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Search className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Button>
        <div className="ml-2 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
          <span className="text-primary text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </span>
        </div>
      </div>
    </header>
  );
}
