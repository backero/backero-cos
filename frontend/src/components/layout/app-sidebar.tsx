"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Box,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Finance", href: "/finance", icon: Receipt },
  { label: "Inventory", href: "/inventory", icon: Box },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Production", href: "/production", icon: Factory },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    clearAuth();
    toast.success("Logged out");
    router.push("/login");
  }

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        animate={{ width: sidebarCollapsed ? 68 : 240 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="relative flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0 overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border shrink-0">
          {/* Leaf icon — always visible, acts as icon in collapsed state */}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="ml-2 overflow-hidden flex items-center"
              >
                <Image
                  src="/logo.png"
                  alt="Backero Private Limited"
                  width={130}
                  height={36}
                  className="object-contain"
                  priority
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </nav>

        {/* Bottom: User + Logout */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1 shrink-0">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center p-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary text-xs font-bold">
                    {user?.name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sidebar-foreground text-xs font-medium truncate">
                    {user?.name}
                  </p>
                  <p className="text-sidebar-foreground/50 text-[10px] truncate capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebarCollapsed}
          className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-sidebar-border border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors z-10"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </motion.aside>
    </TooltipProvider>
  );
}
