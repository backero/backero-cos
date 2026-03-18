"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { format, subMonths } from "date-fns";
import {
  BarChart3,
  CheckCircle2,
  Download,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  useFinanceSummary,
  useMonthlyTrend,
  usePlatformSummary,
  useTasks,
} from "@/hooks/use-queries";
import { cn, formatCurrency } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  amazon: "#FF9900",
  flipkart: "#2874F0",
  meesho: "#F43397",
  website: "#8B5CF6",
  offline: "#6B7280",
};

const CHART_COLORS = ["#E8526A", "#D4A853", "#22c55e", "#3b82f6", "#8b5cf6"];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState("this_month");
  const today = new Date();

  // Date range calculation
  const { from_date, to_date } = (() => {
    switch (dateRange) {
      case "this_month":
        return {
          from_date: format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd"),
          to_date: format(today, "yyyy-MM-dd"),
        };
      case "last_month": {
        const last = subMonths(today, 1);
        return {
          from_date: format(new Date(last.getFullYear(), last.getMonth(), 1), "yyyy-MM-dd"),
          to_date: format(new Date(last.getFullYear(), last.getMonth() + 1, 0), "yyyy-MM-dd"),
        };
      }
      case "last_3_months":
        return {
          from_date: format(subMonths(today, 3), "yyyy-MM-dd"),
          to_date: format(today, "yyyy-MM-dd"),
        };
      default:
        return { from_date: undefined, to_date: undefined };
    }
  })();

  // Queries
  const { data: summary, isLoading: summaryLoading } = useFinanceSummary({ from_date, to_date });
  const { data: monthlyTrend, isLoading: trendLoading } = useMonthlyTrend();
  const { data: platformSummary, isLoading: platformLoading } = usePlatformSummary();
  const { data: allTasks, isLoading: tasksLoading } = useTasks();

  // Task status breakdown for pie chart
  const taskBreakdown = (() => {
    if (!allTasks) return [];
    const counts: Record<string, number> = {};
    allTasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value], i) => ({
      name: name.replace("_", " "),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  })();

  // Invoice status breakdown
  const invoiceBreakdown = summary?.invoices
    ? Object.entries(summary.invoices).map(([status, data]) => ({
        status,
        amount: data.total,
        count: data.count,
      }))
    : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full flex-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-base">Reports & Analytics</h2>
          <p className="text-muted-foreground text-sm">Business overview and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline">
            <Download className="w-4 h-4 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {summaryLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            {[
              {
                label: "Revenue",
                value: summary?.income ?? 0,
                icon: TrendingUp,
                color: "text-green-600",
                bg: "bg-green-100 dark:bg-green-900/30",
              },
              {
                label: "Expenses",
                value: summary?.expense ?? 0,
                icon: TrendingDown,
                color: "text-red-500",
                bg: "bg-red-100 dark:bg-red-900/30",
              },
              {
                label: "Net P&L",
                value: summary?.net ?? 0,
                icon: Receipt,
                color: (summary?.net ?? 0) >= 0 ? "text-green-600" : "text-red-500",
                bg: "bg-muted",
              },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                      <item.icon className={cn("w-5 h-5", item.color)} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
                      <p className={cn("text-xl font-bold", item.color)}>
                        {formatCurrency(item.value)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Revenue vs Expenses Trend ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Monthly Revenue vs Expenses (6 months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlyTrend ?? []}>
                    <defs>
                      <linearGradient id="rpt-income" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rpt-expense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Revenue"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#rpt-income)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#rpt-expense)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Platform Sales Bar Chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Platform Sales Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : !platformSummary || platformSummary.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                  No platform data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={platformSummary} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="platform"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                      {platformSummary.map((entry) => (
                        <Cell
                          key={entry.platform}
                          fill={PLATFORM_COLORS[entry.platform] ?? "#6b7280"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {/* Legend */}
              {!platformLoading && platformSummary && platformSummary.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {platformSummary.map((ps) => (
                    <div key={ps.platform} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: PLATFORM_COLORS[ps.platform] ?? "#6b7280" }}
                      />
                      <span className="capitalize">{ps.platform}</span>
                      <span className="font-medium text-foreground">({ps.orders} orders)</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Task Completion Pie ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Task Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : taskBreakdown.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                  No tasks yet
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={taskBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {taskBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => [v, "Tasks"]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {taskBreakdown.map((item) => (
                      <div key={item.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground capitalize truncate">{item.name}</span>
                        <span className="font-semibold text-foreground ml-auto">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Invoice Status Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />
                Invoice Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : invoiceBreakdown.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No invoices for this period</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {invoiceBreakdown.map((item, i) => (
                    <motion.div
                      key={item.status}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <div className="text-center p-4 rounded-xl bg-muted/50 border border-border">
                        <p className="text-2xl font-bold text-foreground">{item.count}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{item.status}</p>
                        <p className="text-sm font-semibold text-primary mt-2">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
