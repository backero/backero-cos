"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { format, subMonths } from "date-fns";
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Legend,
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
import { useQuery } from "@tanstack/react-query";
import { api, handleApiError } from "@/lib/api-client";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  amazon: "#FF9900",
  flipkart: "#2874F0",
  meesho: "#F43397",
  website: "#8B5CF6",
  offline: "#6B7280",
};

const CHART_COLORS = ["#E8526A", "#D4A853", "#22c55e", "#3b82f6", "#8b5cf6"];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

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

// ── Month/Year Picker ─────────────────────────────────────────────────────────

function MonthYearPicker({
  month, year, onMonth, onYear,
}: {
  month: number; year: number;
  onMonth: (m: number) => void; onYear: (y: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex gap-2">
      <Select value={String(month)} onValueChange={(v) => onMonth(Number(v))}>
        <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => onYear(Number(v))}>
        <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Attendance Report Tab ─────────────────────────────────────────────────────

function AttendanceReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-attendance", month, year],
    queryFn: () => api.reports.attendance(month, year),
  });

  const rows = (data?.rows ?? []) as Array<{
    employee_name: string; designation: string;
    present: number; half_day: number; wfh: number; absent: number; total_days: number;
  }>;

  async function handleDownload() {
    setDownloading(true);
    try {
      await api.reports.downloadExcel("attendance", month, year);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
          {downloading ? "Downloading..." : "Export Excel"}
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Half Day</TableHead>
                <TableHead className="text-center">WFH</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Total Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
              ) : rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.designation}</TableCell>
                  <TableCell className="text-center text-green-600 font-semibold">{r.present}</TableCell>
                  <TableCell className="text-center text-yellow-600">{r.half_day}</TableCell>
                  <TableCell className="text-center text-blue-600">{r.wfh}</TableCell>
                  <TableCell className="text-center text-red-500">{r.absent}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{r.total_days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── GST Report Tab ────────────────────────────────────────────────────────────

function GSTReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-gst", month, year],
    queryFn: () => api.reports.gst(month, year),
  });

  const rows = (data?.rows ?? []) as Array<{
    invoice_number: string; invoice_date: string; customer_name: string; customer_gstin: string;
    taxable_value: number; cgst: number; sgst: number; igst: number; total: number;
  }>;
  const totals = (data?.totals ?? {}) as { taxable_value: number; cgst: number; sgst: number; igst: number; total: number };

  async function handleDownload() {
    setDownloading(true);
    try { await api.reports.downloadExcel("gst", month, year); } catch { toast.error("Download failed"); } finally { setDownloading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />{downloading ? "Downloading..." : "Export Excel"}
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <>
          {rows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Taxable", value: totals.taxable_value },
                { label: "CGST", value: totals.cgst },
                { label: "SGST", value: totals.sgst },
                { label: "IGST", value: totals.igst },
                { label: "Total", value: totals.total },
              ].map((s) => (
                <Card key={s.label}><CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(s.value ?? 0)}</p>
                </CardContent></Card>
              ))}
            </div>
          )}
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No GST invoices for this period</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                    <TableCell>{r.invoice_date}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.customer_gstin}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.taxable_value)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.cgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.sgst)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.igst)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

// ── P&L Report Tab ────────────────────────────────────────────────────────────

function PLReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-pl", month, year],
    queryFn: () => api.reports.pl(month, year),
  });

  const income = (data?.income ?? []) as Array<{ category: string; amount: number }>;
  const expense = (data?.expense ?? []) as Array<{ category: string; amount: number }>;

  async function handleDownload() {
    setDownloading(true);
    try { await api.reports.downloadExcel("pl", month, year); } catch { toast.error("Download failed"); } finally { setDownloading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />{downloading ? "Downloading..." : "Export Excel"}
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Income", value: data?.total_income ?? 0, color: "text-green-600" },
              { label: "Total Expense", value: data?.total_expense ?? 0, color: "text-red-500" },
              { label: "Net Profit", value: data?.net ?? 0, color: (data?.net ?? 0) >= 0 ? "text-green-600" : "text-red-500" },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-xl font-bold mt-1", s.color)}>{formatCurrency(s.value)}</p>
              </CardContent></Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Income Breakdown</CardTitle></CardHeader>
              <CardContent>
                {income.length === 0 ? <p className="text-sm text-muted-foreground">No income entries</p> : (
                  <div className="space-y-2">
                    {income.map((r) => (
                      <div key={r.category} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{r.category}</span>
                        <span className="font-semibold text-green-600">{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-500">Expense Breakdown</CardTitle></CardHeader>
              <CardContent>
                {expense.length === 0 ? <p className="text-sm text-muted-foreground">No expense entries</p> : (
                  <div className="space-y-2">
                    {expense.map((r) => (
                      <div key={r.category} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{r.category}</span>
                        <span className="font-semibold text-red-500">{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Task Performance Report Tab ───────────────────────────────────────────────

function TaskPerformanceReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-tasks", month, year],
    queryFn: () => api.reports.tasks(month, year),
  });

  const rows = (data?.rows ?? []) as Array<{
    employee_name: string; total: number; completed: number; overdue: number;
    avg_completion_hours: number | null; completion_rate: number;
  }>;

  async function handleDownload() {
    setDownloading(true);
    try { await api.reports.downloadExcel("tasks", month, year); } catch { toast.error("Download failed"); } finally { setDownloading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />{downloading ? "Downloading..." : "Export Excel"}
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Overdue</TableHead>
                <TableHead className="text-center">Avg Hours</TableHead>
                <TableHead className="text-center">Completion %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tasks for this period</TableCell></TableRow>
              ) : rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-center">{r.total}</TableCell>
                  <TableCell className="text-center text-green-600 font-semibold">{r.completed}</TableCell>
                  <TableCell className="text-center text-red-500">{r.overdue}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {r.avg_completion_hours != null ? `${r.avg_completion_hours}h` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "font-semibold",
                      r.completion_rate >= 80 ? "text-green-600" : r.completion_rate >= 50 ? "text-yellow-600" : "text-red-500"
                    )}>
                      {r.completion_rate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState("this_month");
  const today = new Date();

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
        return { from_date: format(subMonths(today, 3), "yyyy-MM-dd"), to_date: format(today, "yyyy-MM-dd") };
      default:
        return { from_date: undefined, to_date: undefined };
    }
  })();

  const { data: summary, isLoading: summaryLoading } = useFinanceSummary({ from_date, to_date });
  const { data: monthlyTrend, isLoading: trendLoading } = useMonthlyTrend();
  const { data: platformSummary, isLoading: platformLoading } = usePlatformSummary();
  const { data: allTasksData, isLoading: tasksLoading } = useTasks({ limit: 500 });
  const allTasks = allTasksData?.items;

  const taskBreakdown = (() => {
    if (!allTasks) return [];
    const counts: Record<string, number> = {};
    allTasks.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value], i) => ({
      name: name.replace("_", " "),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  })();

  const invoiceBreakdown = summary?.invoices
    ? Object.entries(summary.invoices).map(([status, data]) => ({ status, amount: data.total, count: data.count }))
    : [];

  return (
    <div className="space-y-6 w-full flex-1">
      <div>
        <h2 className="font-semibold text-base">Reports & Analytics</h2>
        <p className="text-muted-foreground text-sm">Business overview, performance metrics and structured reports</p>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="h-9">
          <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs">Attendance</TabsTrigger>
          <TabsTrigger value="gst" className="text-xs">GST Report</TabsTrigger>
          <TabsTrigger value="pl" className="text-xs">P&amp;L</TabsTrigger>
          <TabsTrigger value="task-perf" className="text-xs">Task Performance</TabsTrigger>
        </TabsList>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics" className="mt-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {summaryLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            ) : (
              <>
                {[
                  { label: "Revenue", value: summary?.income ?? 0, icon: TrendingUp, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
                  { label: "Expenses", value: summary?.expense ?? 0, icon: TrendingDown, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
                  { label: "Net P&L", value: summary?.net ?? 0, icon: Receipt, color: (summary?.net ?? 0) >= 0 ? "text-green-600" : "text-red-500", bg: "bg-muted" },
                ].map((item, i) => (
                  <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                    <Card>
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                          <item.icon className={cn("w-5 h-5", item.color)} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
                          <p className={cn("text-xl font-bold", item.color)}>{formatCurrency(item.value)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Monthly Revenue vs Expenses (6 months)</CardTitle></CardHeader>
                <CardContent>
                  {trendLoading ? <Skeleton className="h-64 w-full" /> : (
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
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area type="monotone" dataKey="income" name="Revenue" stroke="#22c55e" strokeWidth={2} fill="url(#rpt-income)" />
                        <Area type="monotone" dataKey="expense" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#rpt-expense)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Platform Sales Comparison</CardTitle></CardHeader>
                <CardContent>
                  {platformLoading ? <Skeleton className="h-52 w-full" /> : !platformSummary || platformSummary.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No platform data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={platformSummary} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="platform" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                          {platformSummary.map((entry) => <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] ?? "#6b7280"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" />Task Status Breakdown</CardTitle></CardHeader>
                <CardContent>
                  {tasksLoading ? <Skeleton className="h-52 w-full" /> : taskBreakdown.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No tasks yet</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={taskBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                            {taskBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [v, "Tasks"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
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
          </div>
        </TabsContent>

        {/* ── Structured Data Tabs ── */}
        <TabsContent value="attendance" className="mt-6">
          <Card><CardHeader className="pb-4"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Attendance Report</CardTitle></CardHeader>
            <CardContent><AttendanceReport /></CardContent></Card>
        </TabsContent>

        <TabsContent value="gst" className="mt-6">
          <Card><CardHeader className="pb-4"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" />GST Report</CardTitle></CardHeader>
            <CardContent><GSTReport /></CardContent></Card>
        </TabsContent>

        <TabsContent value="pl" className="mt-6">
          <Card><CardHeader className="pb-4"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Profit & Loss Report</CardTitle></CardHeader>
            <CardContent><PLReport /></CardContent></Card>
        </TabsContent>

        <TabsContent value="task-perf" className="mt-6">
          <Card><CardHeader className="pb-4"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" />Task Performance Report</CardTitle></CardHeader>
            <CardContent><TaskPerformanceReport /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
