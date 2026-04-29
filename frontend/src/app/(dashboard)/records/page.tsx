"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Filter, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import type { ActivityLog } from "@/types";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  restore: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  import: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  export: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  approve: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  reject: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  login: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const ENTITY_ICONS: Record<string, string> = {
  task: "📋", employee: "👤", product: "📦", invoice: "🧾",
  batch: "🏭", role: "🔐", entry: "💰",
};

export default function RecordsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: recordsData, isLoading, refetch } = useQuery({
    queryKey: ["records", entityFilter, actionFilter, page],
    queryFn: () => api.records.list({ entity_type: entityFilter || undefined, action: actionFilter || undefined, page, limit: 50 }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const restore = useMutation({
    mutationFn: (id: string) => api.records.restore(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["records"] });
      toast.success(data.message);
    },
    onError: () => toast.error("Restore failed"),
  });

  const allRecords = recordsData?.items ?? [];
  const filtered = allRecords.filter((r: ActivityLog) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.description.toLowerCase().includes(q) ||
      r.actor_name.toLowerCase().includes(q) ||
      (r.entity_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 w-full flex-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Activity Records
          </h2>
          <p className="text-muted-foreground text-sm">{recordsData?.total ?? 0} entries — full audit trail</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={entityFilter || "all"} onValueChange={(v) => { setEntityFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["task", "employee", "product", "invoice", "batch", "role", "entry"].map((e) => (
              <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter || "all"} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {["create", "update", "delete", "restore", "import", "export", "approve", "reject", "login"].map((a) => (
              <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Records list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (filtered?.length ?? 0) === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No records found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((record: ActivityLog, i: number) => (
            <motion.div key={record.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card className={cn("border transition-shadow hover:shadow-sm", record.is_deleted && "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10")}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base shrink-0 mt-0.5">
                      {ENTITY_ICONS[record.entity_type] ?? "📌"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-[10px] px-1.5 py-0 border-0 capitalize", ACTION_COLORS[record.action] ?? "bg-gray-100 text-gray-600")}>
                          {record.action}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {record.entity_type}
                        </Badge>
                        {record.is_deleted && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
                            <Trash2 className="w-2.5 h-2.5 mr-0.5" /> deleted
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1 text-foreground">{record.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        by <span className="font-medium">{record.actor_name}</span> · {formatDate(record.created_at)}
                      </p>
                    </div>
                    {record.is_deleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        onClick={() => restore.mutate(record.id)}
                        disabled={restore.isPending}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {recordsData && recordsData.pages > 1 && (
            <Pagination page={recordsData.page} pages={recordsData.pages} total={recordsData.total} limit={recordsData.limit} onPageChange={setPage} />
          )}
        </div>
      )}
    </div>
  );
}
