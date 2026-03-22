"use client";

import { motion } from "framer-motion";
import {
  ArrowDownRight,
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
import { useDashboardKPIs, useMonthlyTrend } from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/utils";
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
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  index,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  color: string;
  index: number;
}) {
  return (
    <motion.div custom={index} initial="hidden" animate="visible" variants={fadeUp}>
      <Card className="relative overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
          {trend && (
            <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : trend === "down" ? <ArrowDownRight className="w-3 h-3" /> : null}
              <span>{trend === "up" ? "Positive" : trend === "down" ? "Needs attention" : "Stable"}</span>
            </div>
          )}
        </CardContent>
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${color.replace("bg-", "bg-")}`} />
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
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full flex-1">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          index={0}
          title="Revenue This Month"
          value={formatCurrency(kpis?.revenue_this_month ?? 0)}
          subtitle="Total income"
          icon={TrendingUp}
          color="bg-green-500"
          trend="up"
        />
        <KPICard
          index={1}
          title="Expenses"
          value={formatCurrency(kpis?.expenses_this_month ?? 0)}
          subtitle="Total outflow"
          icon={ArrowDownRight}
          color="bg-red-500"
          trend={kpis && kpis.expenses_this_month > kpis.revenue_this_month ? "down" : "neutral"}
        />
        <KPICard
          index={2}
          title="Net Profit"
          value={formatCurrency(kpis?.net_profit ?? 0)}
          subtitle="Revenue − Expenses"
          icon={Receipt}
          color="bg-brand-green"
          trend={(kpis?.net_profit ?? 0) >= 0 ? "up" : "down"}
        />
        <KPICard
          index={3}
          title="Pending Invoices"
          value={`${kpis?.pending_invoices_count ?? 0}`}
          subtitle={formatCurrency(kpis?.pending_invoices_amount ?? 0) + " pending"}
          icon={Clock}
          color="bg-orange-500"
          trend={kpis && kpis.pending_invoices_count > 5 ? "down" : "neutral"}
        />
        <KPICard
          index={4}
          title="Total Employees"
          value={String(kpis?.total_employees ?? 0)}
          subtitle={`${kpis?.present_today ?? 0} present today`}
          icon={Users}
          color="bg-blue-500"
        />
        <KPICard
          index={5}
          title="Tasks"
          value={String(kpis?.tasks.total ?? 0)}
          subtitle={`${kpis?.tasks.overdue ?? 0} overdue`}
          icon={CheckCircle2}
          color="bg-purple-500"
          trend={kpis && kpis.tasks.overdue > 0 ? "down" : "up"}
        />
        <KPICard
          index={6}
          title="Completed Tasks"
          value={String(kpis?.tasks.completed ?? 0)}
          subtitle={`${kpis?.tasks.in_progress ?? 0} in progress`}
          icon={CheckCircle2}
          color="bg-teal-500"
          trend="up"
        />
        <KPICard
          index={7}
          title="Low Stock Items"
          value={String(kpis?.low_stock_products ?? 0)}
          subtitle="Products need restocking"
          icon={Package}
          color="bg-yellow-500"
          trend={kpis && kpis.low_stock_products > 0 ? "down" : "neutral"}
        />
      </div>

      {/* Monthly Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
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
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), ""]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#income-grad)"
                    name="Income"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#expense-grad)"
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
