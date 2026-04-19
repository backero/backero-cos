"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Bell, BellOff, CheckCheck, ClipboardList, Menu, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "@/hooks/use-queries";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tasks",
  "/finance": "Finance",
  "/inventory": "Inventory",
  "/employees": "Employees",
  "/production": "Production",
  "/reports": "Reports",
  "/roles": "Roles & Access",
  "/profile": "My Profile",
};

const NOTIF_TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  task_assigned: { icon: <ClipboardList className="w-3.5 h-3.5" />, bg: "bg-blue-100 dark:bg-blue-900/40", color: "text-blue-600 dark:text-blue-400" },
  status_changed: { icon: <RefreshCw className="w-3.5 h-3.5" />, bg: "bg-violet-100 dark:bg-violet-900/40", color: "text-violet-600 dark:text-violet-400" },
  comment_added: { icon: <MessageSquare className="w-3.5 h-3.5" />, bg: "bg-emerald-100 dark:bg-emerald-900/40", color: "text-emerald-600 dark:text-emerald-400" },
  task_overdue: { icon: <AlertTriangle className="w-3.5 h-3.5" />, bg: "bg-red-100 dark:bg-red-900/40", color: "text-red-600 dark:text-red-400" },
};

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-800 dark:text-white">Notifications</span>
        <button
          onClick={() => markAll.mutate()}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <CheckCheck className="w-3 h-3" /> Mark all read
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <BellOff className="w-6 h-6" />
            <p className="text-xs">No notifications</p>
          </div>
        ) : (
          notifications.map((n) => {
            const cfg = NOTIF_TYPE_CONFIG[n.type] ?? NOTIF_TYPE_CONFIG.task_assigned;
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                className={cn(
                  "flex gap-3 px-4 py-3 cursor-pointer transition-colors",
                  n.is_read ? "opacity-50" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                )}
              >
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", cfg.bg, cfg.color)}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{n.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const [showNotifs, setShowNotifs] = useState(false);
  const { data: countData } = useUnreadCount();
  const unreadCount = countData?.count ?? 0;

  const title = PAGE_TITLES[pathname] ?? "Backero COS";

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden">
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
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground"
            onClick={() => setShowNotifs((v) => !v)}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <div className="relative z-50">
                <NotificationPanel onClose={() => setShowNotifs(false)} />
              </div>
            </>
          )}
        </div>
        <div className="ml-2 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
          <span className="text-primary text-xs font-bold">{user?.name?.[0]?.toUpperCase() ?? "U"}</span>
        </div>
      </div>
    </header>
  );
}
