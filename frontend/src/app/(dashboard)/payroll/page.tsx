"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, RefreshCw, CheckCircle, Clock, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { clientFetch, ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";

interface PayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string | null;
  employee_designation: string | null;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  half_days: number;
  basic_salary: number;
  hra: number;
  allowances: number;
  gross_salary: number;
  pf_employee: number;
  esi_employee: number;
  tds: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  payment_mode: string;
  payment_date: string | null;
  status: "draft" | "approved" | "paid";
  created_at: string;
}

interface PayrollSummary {
  month: number;
  year: number;
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  paid_count: number;
  draft_count: number;
  approved_count: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const statusColor: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export default function PayrollPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);
  const [genYear, setGenYear] = useState(now.getFullYear());
  const qc = useQueryClient();

  const { data: records, isLoading } = useQuery({
    queryKey: ["payroll", selectedMonth, selectedYear],
    queryFn: () => clientFetch<PayrollRecord[]>(`/payroll/?month=${selectedMonth}&year=${selectedYear}`),
  });

  const { data: summary } = useQuery({
    queryKey: ["payroll-summary", selectedMonth, selectedYear],
    queryFn: () => clientFetch<PayrollSummary>(`/payroll/summary?month=${selectedMonth}&year=${selectedYear}`),
  });

  const generateMutation = useMutation({
    mutationFn: (params: { month: number; year: number }) =>
      clientFetch<PayrollRecord[]>("/payroll/generate", {
        method: "POST",
        body: JSON.stringify({ month: params.month, year: params.year, working_days: 26 }),
      }),
    onSuccess: (data) => {
      toast.success(`Generated payroll for ${data.length} employees`);
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["payroll-summary"] });
      setGenerateOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to generate payroll"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      clientFetch(`/payroll/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["payroll-summary"] });
    },
  });

  const downloadPayslip = async (recordId: string, empName: string, month: number, year: number) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const res = await fetch(`${apiBase}/api/v1/payroll/${recordId}/payslip`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { toast.error("Failed to download payslip"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Payslip_${empName}_${MONTHS[month - 1]}_${year}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6 w-full flex-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Payroll</h2>
          <p className="text-sm text-muted-foreground">Manage salary & payslips</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Generate Payroll
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: "Total Employees", value: String(summary.total_employees), icon: Users, color: "bg-blue-500" },
            { title: "Total Gross", value: formatCurrency(summary.total_gross), icon: DollarSign, color: "bg-purple-500" },
            { title: "Total Net Pay", value: formatCurrency(summary.total_net), icon: CheckCircle, color: "bg-green-500" },
            { title: "Paid", value: `${summary.paid_count} / ${summary.total_employees}`, icon: Clock, color: "bg-orange-500" },
          ].map((c, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.title}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{c.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-lg ${c.color} flex items-center justify-center`}>
                    <c.icon className="w-4 h-4 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Records table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {MONTHS[selectedMonth - 1]} {selectedYear} · {records?.length ?? 0} employees
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : records?.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No payroll generated for this month.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setGenerateOpen(true)}>
                Generate Now
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase">
                    <th className="text-left px-4 py-3 font-medium">Employee</th>
                    <th className="text-right px-4 py-3 font-medium">Present</th>
                    <th className="text-right px-4 py-3 font-medium">Gross</th>
                    <th className="text-right px-4 py-3 font-medium">Deductions</th>
                    <th className="text-right px-4 py-3 font-medium">Net Pay</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-center px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records?.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{r.employee_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.employee_designation ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {r.present_days}/{r.working_days}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.gross_salary)}</td>
                      <td className="px-4 py-3 text-right text-red-500">-{formatCurrency(r.total_deductions)}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(r.net_salary)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {r.status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: r.id, status: "approved" })}
                            >
                              Approve
                            </Button>
                          )}
                          {r.status === "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-green-600 border-green-300"
                              onClick={() => updateStatusMutation.mutate({ id: r.id, status: "paid" })}
                            >
                              Mark Paid
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Download payslip"
                            onClick={() => downloadPayslip(r.id, r.employee_name ?? "employee", r.month, r.year)}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate payroll dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Month</label>
                <Select value={String(genMonth)} onValueChange={(v) => setGenMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Year</label>
                <Select value={String(genYear)} onValueChange={(v) => setGenYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This will auto-calculate salaries based on attendance records. Employees with no salary set will be skipped.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate({ month: genMonth, year: genYear })}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
