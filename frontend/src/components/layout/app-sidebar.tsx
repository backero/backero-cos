"use client";

import React from "react";
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
  LayoutDashboard,
  LogOut,
  Receipt,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Module } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  module: Module;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { label: "Tasks",     href: "/tasks",     icon: ClipboardList,   module: "tasks"     },
  { label: "Finance",   href: "/finance",   icon: Receipt,         module: "finance"   },
  { label: "Inventory", href: "/inventory", icon: Box,             module: "inventory" },
  { label: "Employees", href: "/employees", icon: Users,           module: "employees" },
  { label: "Production",href: "/production",icon: Factory,         module: "production"},
  { label: "Reports",   href: "/reports",   icon: BarChart3,       module: "reports"   },
  { label: "Roles",     href: "/roles",     icon: ShieldCheck,     module: "roles"     },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { user, clearAuth, canView } = useAuthStore();
  const visibleNav = NAV_ITEMS.filter((item) => canView(item.module));
  const [confirmLogout, setConfirmLogout] = React.useState(false);

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
        className="relative flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0"
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
          {visibleNav.map((item) => {
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

        {/* Bottom: User + Profile + Logout */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-1 shrink-0">
          {sidebarCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/profile"
                    className="w-full flex items-center justify-center p-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <User className="w-4 h-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">My Profile</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setConfirmLogout(true)}
                    className="w-full flex items-center justify-center p-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Logout</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary text-xs font-bold">
                    {user?.name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sidebar-foreground text-xs font-medium truncate group-hover:text-sidebar-accent-foreground">
                    {user?.name}
                  </p>
                  <p className="text-sidebar-foreground/50 text-[10px] truncate">
                    {user?.role}
                  </p>
                </div>
                <User className="w-3.5 h-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60 shrink-0" />
              </Link>
              <button
                onClick={() => setConfirmLogout(true)}
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
          className="absolute top-1/2  -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-sidebar-border border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors z-50"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </motion.aside>

      {/* ── Logout confirmation ── */}
      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent className="max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-1">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">Sign out?</DialogTitle>
            <DialogDescription className="text-center">
              You will be returned to the login screen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-row gap-2 mt-1">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmLogout(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleLogout}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
