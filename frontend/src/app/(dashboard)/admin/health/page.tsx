"use client";

import { format } from "date-fns";
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAdminHealth } from "@/hooks/use-queries";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function AdminHealthPage() {
  const { data, isLoading, error } = useAdminHealth();
  const qc = useQueryClient();

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-health"] });
  }

  const dbOk = data?.db_status === "ok";
  const checkedAt = data?.checked_at
    ? format(new Date(data.checked_at as string), "MMM d, yyyy HH:mm:ss")
    : null;

  const metrics = [
    { label: "Overdue Tasks", value: data?.overdue_tasks_count as number ?? 0, icon: AlertTriangle, warn: (v: number) => v > 0 },
    { label: "Low Stock Items", value: data?.low_stock_count as number ?? 0, icon: AlertTriangle, warn: (v: number) => v > 0 },
    { label: "Pending Payroll", value: data?.pending_payroll_count as number ?? 0, icon: Clock, warn: (v: number) => v > 0 },
    { label: "WhatsApp Failures", value: data?.failed_wa_count as number ?? 0, icon: Activity, warn: (v: number) => v > 5 },
  ];

  const jobs = (data?.scheduler_jobs as Array<{ id: string; next_run: string | null }>) ?? [];

  return (
    <div className="space-y-6 w-full flex-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-base">System Health</h2>
          <p className="text-muted-foreground text-sm">Super Admin · Live system status dashboard</p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
          Access denied. Super Admin only.
        </div>
      )}

      {/* DB Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" /> Database Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-8 w-40" /> : (
            <div className="flex items-center gap-3">
              {dbOk ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
              <span className={cn("font-medium", dbOk ? "text-green-600" : "text-red-500")}>
                {dbOk ? "Connected" : String(data?.db_status ?? "Unknown error")}
              </span>
              {checkedAt && (
                <span className="text-xs text-muted-foreground ml-auto">Checked at {checkedAt}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : metrics.map((m) => {
              const bad = m.warn(m.value);
              return (
                <Card key={m.label} className={cn(bad && "border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20")}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <m.icon className={cn("w-4 h-4", bad ? "text-amber-500" : "text-muted-foreground")} />
                      <Badge variant={bad ? "destructive" : "secondary"} className="text-[10px]">
                        {bad ? "Action needed" : "OK"}
                      </Badge>
                    </div>
                    <p className={cn("text-2xl font-bold", bad ? "text-amber-600" : "text-foreground")}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Scheduler Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Scheduled Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduler data available</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-mono text-xs text-muted-foreground">{job.id}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {job.next_run ? `Next: ${format(new Date(job.next_run), "MMM d HH:mm")}` : "Not scheduled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
