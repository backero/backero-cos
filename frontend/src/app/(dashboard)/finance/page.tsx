"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateEntry,
  useCreateInvoice,
  useEntries,
  useFinanceSummary,
  useInvoices,
} from "@/hooks/use-queries";
import { cn, formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

const entrySchema = z.object({
  date: z.string().min(1, "Date required"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category required"),
  description: z.string().min(2),
  amount: z.number().positive(),
  payment_mode: z.enum(["cash", "bank", "upi", "cheque"]),
  reference: z.string().optional(),
});

type EntryForm = z.infer<typeof entrySchema>;

export default function FinancePage() {
  const { modals, openModal, closeModal } = useUIStore();

  const { data: summary, isLoading: summaryLoading } = useFinanceSummary();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: entries, isLoading: entriesLoading } = useEntries();

  const createEntry = useCreateEntry();

  const entryForm = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      type: "income",
      payment_mode: "cash",
      amount: 0,
    },
  });

  async function onEntrySubmit(data: EntryForm) {
    await createEntry.mutateAsync(data as Record<string, unknown>);
    entryForm.reset();
    closeModal("createEntry");
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {summaryLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
              <Card className="border-green-200 dark:border-green-900/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Income</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(summary?.income ?? 0)}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <Card className="border-red-200 dark:border-red-900/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Expense</p>
                    <p className="text-xl font-bold text-red-500">{formatCurrency(summary?.expense ?? 0)}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <Card>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", (summary?.net ?? 0) >= 0 ? "bg-brand-rose" : "bg-orange-500")}>
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Net P&L</p>
                    <p className={cn("text-xl font-bold", (summary?.net ?? 0) >= 0 ? "text-green-600" : "text-red-500")}>
                      {formatCurrency(summary?.net ?? 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entries">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="entries">Entries</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openModal("createInvoice")}>
              <Plus className="w-4 h-4 mr-1" /> Invoice
            </Button>
            <Button size="sm" onClick={() => openModal("createEntry")}>
              <Plus className="w-4 h-4 mr-1" /> Entry
            </Button>
          </div>
        </div>

        <TabsContent value="entries" className="space-y-2">
          {entriesLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : entries?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No entries yet</div>
          ) : (
            entries?.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      entry.type === "income" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
                    )}>
                      {entry.type === "income"
                        ? <ArrowUpRight className="w-4 h-4 text-green-600" />
                        : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">{entry.category} · {entry.payment_mode} · {formatDate(entry.date)}</p>
                    </div>
                    <p className={cn("text-sm font-bold shrink-0", entry.type === "income" ? "text-green-600" : "text-red-500")}>
                      {entry.type === "income" ? "+" : "−"}{formatCurrency(entry.amount)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-2">
          {invoicesLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
          ) : invoices?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No invoices yet</div>
          ) : (
            invoices?.map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Receipt className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{inv.invoice_number}</p>
                        <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(inv.status))}>
                          {inv.status}
                        </Badge>
                        {inv.is_gst && <Badge variant="outline" className="text-[10px] px-1.5 py-0">GST</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{inv.customer_name} · {formatDate(inv.invoice_date)}</p>
                    </div>
                    <p className="text-sm font-bold shrink-0">{formatCurrency(inv.total)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create Entry Dialog */}
      <Dialog open={modals["createEntry"]} onOpenChange={(o) => !o && closeModal("createEntry")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Account Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={entryForm.handleSubmit(onEntrySubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...entryForm.register("date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select defaultValue="income" onValueChange={(v) => entryForm.setValue("type", v as "income" | "expense")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input {...entryForm.register("category")} placeholder="e.g. Sales, Rent" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" step="0.01" {...entryForm.register("amount", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input {...entryForm.register("description")} placeholder="Brief description..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select defaultValue="cash" onValueChange={(v) => entryForm.setValue("payment_mode", v as EntryForm["payment_mode"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input {...entryForm.register("reference")} placeholder="UTR / Cheque no." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => closeModal("createEntry")}>Cancel</Button>
              <Button type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                Add Entry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
