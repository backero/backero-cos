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
  Check,
  Loader2,
  Minus,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  X,
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateEntry,
  useCreateInvoice,
  useEntries,
  useFinanceSummary,
  useInvoices,
  useUpdateInvoiceStatus,
} from "@/hooks/use-queries";
import { cn, formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import type { Invoice } from "@/types";

// ── Schemas ────────────────────────────────────────────────────────────────────

const entrySchema = z.object({
  date: z.string().min(1, "Date required"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category required"),
  description: z.string().min(2),
  amount: z.number().positive("Amount must be positive"),
  payment_mode: z.enum(["cash", "bank", "upi", "cheque"]),
  reference: z.string().optional(),
});

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.number().positive("Must be > 0"),
  unit_price: z.number().positive("Must be > 0"),
  gst_rate: z.number().min(0).max(28),
});

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number required"),
  invoice_date: z.string().min(1, "Date required"),
  due_date: z.string().optional(),
  customer_name: z.string().min(1, "Customer name required"),
  customer_phone: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal("")),
  customer_address: z.string().optional(),
  customer_gstin: z.string().optional(),
  is_gst: z.boolean().default(true),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item required"),
});

type EntryForm = z.infer<typeof entrySchema>;
type InvoiceForm = z.infer<typeof invoiceSchema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { modals, openModal, closeModal } = useUIStore();

  const { data: summary, isLoading: summaryLoading } = useFinanceSummary();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: entries, isLoading: entriesLoading } = useEntries();

  const createEntry = useCreateEntry();
  const createInvoice = useCreateInvoice();
  const updateInvoiceStatus = useUpdateInvoiceStatus();

  // ── Entry Form ──
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

  // ── Invoice Form ──
  const invoiceForm = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_date: format(new Date(), "yyyy-MM-dd"),
      is_gst: true,
      items: [{ description: "", quantity: 1, unit_price: 0, gst_rate: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: invoiceForm.control,
    name: "items",
  });

  const watchedItems = invoiceForm.watch("items");
  const isGst = invoiceForm.watch("is_gst");

  // Calculate invoice totals live
  const subtotal = watchedItems.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.unit_price || 0);
  }, 0);
  const gstAmount = isGst
    ? watchedItems.reduce((sum, item) => {
        return sum + (item.quantity || 0) * (item.unit_price || 0) * ((item.gst_rate || 0) / 100);
      }, 0)
    : 0;
  const total = subtotal + gstAmount;

  async function onInvoiceSubmit(data: InvoiceForm) {
    await createInvoice.mutateAsync({
      ...data,
      customer_email: data.customer_email || undefined,
      due_date: data.due_date || undefined,
    } as Record<string, unknown>);
    invoiceForm.reset();
    closeModal("createInvoice");
  }

  return (
    <div className="space-y-6 w-full flex-1">
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

        {/* Entries Tab */}
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

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-2">
          {invoicesLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
          ) : invoices?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No invoices yet</div>
          ) : (
            invoices?.map((inv, i) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                index={i}
                onStatusChange={(status) => updateInvoiceStatus.mutate({ id: inv.id, status })}
                statusLoading={updateInvoiceStatus.isPending}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Entry Dialog ── */}
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
                {entryForm.formState.errors.category && (
                  <p className="text-xs text-destructive">{entryForm.formState.errors.category.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" step="0.01" {...entryForm.register("amount", { valueAsNumber: true })} />
                {entryForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">{entryForm.formState.errors.amount.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input {...entryForm.register("description")} placeholder="Brief description..." />
              {entryForm.formState.errors.description && (
                <p className="text-xs text-destructive">{entryForm.formState.errors.description.message}</p>
              )}
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

      {/* ── Create Invoice Dialog ── */}
      <Dialog open={modals["createInvoice"]} onOpenChange={(o) => !o && closeModal("createInvoice")}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={invoiceForm.handleSubmit(onInvoiceSubmit)} className="space-y-5">

            {/* Invoice meta */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Invoice Number *</Label>
                <Input {...invoiceForm.register("invoice_number")} placeholder="INV-2025-001" />
                {invoiceForm.formState.errors.invoice_number && (
                  <p className="text-xs text-destructive">{invoiceForm.formState.errors.invoice_number.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Date *</Label>
                <Input type="date" {...invoiceForm.register("invoice_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" {...invoiceForm.register("due_date")} />
              </div>
            </div>

            {/* Customer info */}
            <div className="border rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Customer Name *</Label>
                  <Input {...invoiceForm.register("customer_name")} placeholder="e.g. ABC Distributors Pvt. Ltd." />
                  {invoiceForm.formState.errors.customer_name && (
                    <p className="text-xs text-destructive">{invoiceForm.formState.errors.customer_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input {...invoiceForm.register("customer_phone")} placeholder="10-digit mobile" maxLength={10} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" {...invoiceForm.register("customer_email")} placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label>GSTIN</Label>
                  <Input {...invoiceForm.register("customer_gstin")} placeholder="15-char GSTIN" maxLength={15} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input {...invoiceForm.register("customer_address")} placeholder="Optional" />
                </div>
              </div>
            </div>

            {/* GST toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => invoiceForm.setValue("is_gst", !isGst)}
                className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  isGst ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  isGst ? "translate-x-5" : "translate-x-1"
                )} />
              </button>
              <Label className="cursor-pointer" onClick={() => invoiceForm.setValue("is_gst", !isGst)}>
                GST Invoice (CGST + SGST applicable)
              </Label>
            </div>

            {/* Line Items */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Line Items
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => append({ description: "", quantity: 1, unit_price: 0, gst_rate: 18 })}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>

              <div className="divide-y divide-border">
                {fields.map((field, index) => {
                  const qty = watchedItems[index]?.quantity || 0;
                  const price = watchedItems[index]?.unit_price || 0;
                  const rate = watchedItems[index]?.gst_rate || 0;
                  const lineAmt = qty * price;
                  const lineGst = isGst ? lineAmt * rate / 100 : 0;

                  return (
                    <div key={field.id} className="p-3 space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            {...invoiceForm.register(`items.${index}.description`)}
                            placeholder="Item description..."
                            className="h-8 text-sm"
                          />
                        </div>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => remove(index)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 items-end">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">Qty</p>
                          <Input
                            type="number"
                            step="0.001"
                            className="h-8 text-sm"
                            {...invoiceForm.register(`items.${index}.quantity`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">Unit Price (₹)</p>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-sm"
                            {...invoiceForm.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground">GST %</p>
                          <Select
                            value={String(watchedItems[index]?.gst_rate ?? 18)}
                            onValueChange={(v) => invoiceForm.setValue(`items.${index}.gst_rate`, Number(v))}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 5, 12, 18, 28].map((g) => (
                                <SelectItem key={g} value={String(g)}>{g}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[10px] text-muted-foreground">Amount</p>
                          <p className="text-sm font-semibold h-8 flex items-center justify-end">
                            {formatCurrency(lineAmt + lineGst)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t bg-muted/30 px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {isGst && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>CGST</span>
                      <span>{formatCurrency(gstAmount / 2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>SGST</span>
                      <span>{formatCurrency(gstAmount / 2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {invoiceForm.formState.errors.items && (
              <p className="text-xs text-destructive">{invoiceForm.formState.errors.items.message}</p>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...invoiceForm.register("notes")} rows={2} placeholder="Optional notes or payment terms..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => closeModal("createInvoice")}>Cancel</Button>
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Create Invoice
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Invoice Row ────────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  index,
  onStatusChange,
  statusLoading,
}: {
  invoice: Invoice;
  index: number;
  onStatusChange: (status: string) => void;
  statusLoading: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Receipt className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{invoice.invoice_number}</p>
                <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(invoice.status))}>
                  {invoice.status}
                </Badge>
                {invoice.is_gst && <Badge variant="outline" className="text-[10px] px-1.5 py-0">GST</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {invoice.customer_name} · {formatDate(invoice.invoice_date)}
                {invoice.due_date && ` · Due ${formatDate(invoice.due_date)}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{formatCurrency(invoice.total)}</p>
              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <button
                  className="text-[10px] text-primary hover:underline mt-0.5"
                  onClick={() => setShowActions(!showActions)}
                >
                  Change status
                </button>
              )}
            </div>
          </div>

          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex gap-2 mt-3 pt-3 border-t border-border overflow-hidden"
            >
              {(["pending", "paid", "overdue", "cancelled"] as const)
                .filter((s) => s !== invoice.status)
                .map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs capitalize"
                    disabled={statusLoading}
                    onClick={() => {
                      onStatusChange(s);
                      setShowActions(false);
                    }}
                  >
                    {statusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Mark {s}
                  </Button>
                ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
