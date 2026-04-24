"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Package,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDashboardKPIs,
  useMonthlyTrend,
  useProducts,
  useTasks,
  useInvoices,
} from "@/hooks/use-queries";
import { cn, formatCurrency } from "@/lib/utils";
import { isPast, format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.35 } }),
};

function KPICard({
  title, value, subtitle, icon: Icon, color, index, href, trend,
}: {
  title: string; value: string; subtitle?: string; icon: React.ElementType;
  color: string; index: number; href?: string; trend?: "up" | "down" | "neutral";
}) {
  const router = useRouter();
  return (
    <motion.div custom={index} initial="hidden" animate="visible" variants={fadeUp}>
      <Card
        className={cn("relative overflow-hidden transition-shadow", href && "cursor-pointer hover:shadow-md")}
        onClick={() => href && router.push(href)}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
            </div>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
          {trend && (
            <div className={cn("flex items-center gap-1 mt-3 text-xs font-medium",
              trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-muted-foreground")}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : trend === "down" ? <ArrowDownRight className="w-3 h-3" /> : null}
              {href && <span className="text-primary flex items-center gap-0.5">View <ArrowRight className="w-3 h-3" /></span>}
            </div>
          )}
        </CardContent>
        <div className={cn("absolute bottom-0 left-0 right-0 h-0.5", color)} />
      </Card>
    </motion.div>
  );
}

function OverdueTasksWidget() {
  const router = useRouter();
  const { data: tasks = [] } = useTasks({ status: "overdue" });
  if (!tasks.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Overdue Tasks ({tasks.length})
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-red-600" onClick={() => router.push("/tasks")}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-2">
          {tasks.slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
              <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{t.title}</span>
              {t.assigned_to && <span className="text-[10px] text-slate-400 shrink-0">{t.assigned_to.name.split(" ")[0]}</span>}
              {t.due_date && <span className="text-[10px] text-red-500 font-medium shrink-0">{format(new Date(t.due_date), "dd MMM")}</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LowStockWidget() {
  const router = useRouter();
  const { data: products = [] } = useProducts({ low_stock: true });
  if (!products.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
      <Card className="border-orange-200 dark:border-orange-900/50">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-orange-600 flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Low Stock ({products.length})
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-orange-600" onClick={() => router.push("/inventory")}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-2">
          {products.slice(0, 4).map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30">
              <Package className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{p.name}</span>
              <span className="text-[10px] font-semibold text-orange-600 shrink-0">{p.current_stock} left</span>
              <span className="text-[10px] text-slate-400 shrink-0">min {p.reorder_level}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PendingInvoicesWidget() {
  const router = useRouter();
  const { data: invoices = [] } = useInvoices({ status: "pending" });
  if (!invoices.length) return null;
  const total = invoices.reduce((s, i) => s + i.total, 0);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
      <Card className="border-blue-200 dark:border-blue-900/50">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-blue-600 flex items-center gap-1.5">
              <Receipt className="w-4 h-4" /> Pending Invoices — {formatCurrency(total)}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-blue-600" onClick={() => router.push("/finance")}>
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-2">
          {invoices.slice(0, 4).map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <Receipt className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{inv.customer_name}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{inv.invoice_number}</span>
              <span className="text-[10px] font-semibold text-blue-600 shrink-0">{formatCurrency(inv.total)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: trend, isLoading: trendLoading } = useMonthlyTrend();

  if (kpisLoading) {
    return (
      <div className="space-y-6 w-full flex-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full flex-1">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard index={0} title="Revenue This Month" value={formatCurrency(kpis?.revenue_this_month ?? 0)}
          subtitle="Total income" icon={TrendingUp} color="bg-green-500" href="/finance" trend="up" />
        <KPICard index={1} title="Expenses" value={formatCurrency(kpis?.expenses_this_month ?? 0)}
          subtitle="Total outflow" icon={ArrowDownRight} color="bg-red-500" href="/finance"
          trend={(kpis?.expenses_this_month ?? 0) > (kpis?.revenue_this_month ?? 0) ? "down" : "neutral"} />
        <KPICard index={2} title="Net Profit" value={formatCurrency(kpis?.net_profit ?? 0)}
          subtitle="Revenue − Expenses" icon={Receipt} color="bg-teal-600"
          trend={(kpis?.net_profit ?? 0) >= 0 ? "up" : "down"} />
        <KPICard index={3} title="Pending Invoices" value={`${kpis?.pending_invoices_count ?? 0}`}
          subtitle={formatCurrency(kpis?.pending_invoices_amount ?? 0) + " due"}
          icon={Clock} color="bg-orange-500" href="/finance"
          trend={kpis && kpis.pending_invoices_count > 0 ? "down" : "neutral"} />
        <KPICard index={4} title="Employees" value={String(kpis?.total_employees ?? 0)}
          subtitle={`${kpis?.present_today ?? 0} present today`}
          icon={Users} color="bg-blue-500" href="/employees" />
        <KPICard index={5} title="Overdue Tasks" value={String(kpis?.tasks.overdue ?? 0)}
          subtitle={`${kpis?.tasks.total ?? 0} total tasks`}
          icon={AlertTriangle} color="bg-red-500" href="/tasks"
          trend={kpis && kpis.tasks.overdue > 0 ? "down" : "up"} />
        <KPICard index={6} title="Tasks Done" value={String(kpis?.tasks.completed ?? 0)}
          subtitle={`${kpis?.tasks.in_progress ?? 0} in progress`}
          icon={CheckCircle2} color="bg-purple-500" href="/tasks" trend="up" />
        <KPICard index={7} title="Low Stock Items" value={String(kpis?.low_stock_products ?? 0)}
          subtitle="Need restocking"
          icon={Package} color="bg-yellow-500" href="/inventory"
          trend={kpis && kpis.low_stock_products > 0 ? "down" : "neutral"} />
      </div>

      {/* Actionable Alert Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <OverdueTasksWidget />
        <LowStockWidget />
        <PendingInvoicesWidget />
      </div>

      {/* Monthly Trend Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend ?? []}>
                  <defs>
                    <linearGradient id="income-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expense-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), ""]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} fill="url(#income-grad)" name="Income" />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expense-grad)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
