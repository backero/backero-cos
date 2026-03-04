"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Factory,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useBatches,
  useCreateBatch,
  useCreateRawMaterial,
  useProducts,
  useRawMaterials,
  useUpdateBatchStatus,
} from "@/hooks/use-queries";
import { useUIStore } from "@/stores/ui-store";
import { cn, formatDate, getStatusColor } from "@/lib/utils";
import type { ProductionBatch, RawMaterial } from "@/types";

// ── Schemas ────────────────────────────────────────────────────────────────────

const batchSchema = z.object({
  batch_number: z.string().min(2, "Batch number required"),
  product_id: z.string().min(1, "Product required"),
  planned_quantity: z.number().positive("Must be > 0"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().optional(),
});

const rawMaterialSchema = z.object({
  name: z.string().min(2, "Name required"),
  unit: z.string().min(1),
  current_stock: z.number().min(0),
  reorder_level: z.number().min(0),
  cost_per_unit: z.number().min(0),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

type BatchForm = z.infer<typeof batchSchema>;
type RawMaterialForm = z.infer<typeof rawMaterialSchema>;

// ── Status helpers ─────────────────────────────────────────────────────────────

const BATCH_STATUSES = ["planned", "in_progress", "completed", "rejected"] as const;

function getBatchStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    case "in_progress":
      return <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    case "planned":
      return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    case "rejected":
      return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const { modals, openModal, closeModal } = useUIStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);

  // Queries
  const { data: batches, isLoading: batchesLoading } = useBatches({
    status: statusFilter || undefined,
  });
  const { data: rawMaterials, isLoading: rawMatsLoading } = useRawMaterials();
  const { data: products } = useProducts();

  // Mutations
  const createBatch = useCreateBatch();
  const updateBatchStatus = useUpdateBatchStatus();
  const createRawMaterial = useCreateRawMaterial();

  // Forms
  const batchForm = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: { planned_quantity: 0 },
  });

  const rawMatForm = useForm<RawMaterialForm>({
    resolver: zodResolver(rawMaterialSchema),
    defaultValues: { unit: "kg", current_stock: 0, reorder_level: 5, cost_per_unit: 0 },
  });

  // Derived
  const lowStockMaterials = rawMaterials?.filter((m) => m.is_low_stock) ?? [];
  const batchStats = {
    planned: batches?.filter((b) => b.status === "planned").length ?? 0,
    in_progress: batches?.filter((b) => b.status === "in_progress").length ?? 0,
    completed: batches?.filter((b) => b.status === "completed").length ?? 0,
    rejected: batches?.filter((b) => b.status === "rejected").length ?? 0,
  };

  // Handlers
  async function onCreateBatch(data: BatchForm) {
    await createBatch.mutateAsync(data as Record<string, unknown>);
    batchForm.reset();
    closeModal("createBatch");
  }

  async function onCreateRawMaterial(data: RawMaterialForm) {
    await createRawMaterial.mutateAsync(data as Record<string, unknown>);
    rawMatForm.reset();
    closeModal("createRawMaterial");
  }

  async function onUpdateStatus(batchId: string, status: string) {
    await updateBatchStatus.mutateAsync({ id: batchId, status });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Planned", value: batchStats.planned, color: "bg-yellow-500", icon: Clock },
          { label: "In Progress", value: batchStats.in_progress, color: "bg-blue-500", icon: RefreshCw },
          { label: "Completed", value: batchStats.completed, color: "bg-green-500", icon: CheckCircle2 },
          { label: "Rejected", value: batchStats.rejected, color: "bg-red-500", icon: AlertTriangle },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", stat.color)}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label} Batches</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Low stock materials alert ── */}
      {lowStockMaterials.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl"
        >
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {lowStockMaterials.length} raw material{lowStockMaterials.length > 1 ? "s" : ""} need restocking
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              {lowStockMaterials.map((m) => `${m.name} (${m.current_stock}${m.unit})`).join(" · ")}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Tabs: Batches | Raw Materials ── */}
      <Tabs defaultValue="batches">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="batches" className="gap-2">
              <Layers className="w-3.5 h-3.5" /> Production Batches
            </TabsTrigger>
            <TabsTrigger value="materials" className="gap-2">
              <Package className="w-3.5 h-3.5" /> Raw Materials
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Tabs value="batches">
              <TabsContent value="batches" asChild>
                <></>
              </TabsContent>
            </Tabs>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openModal("createRawMaterial")}
            >
              <Plus className="w-4 h-4 mr-1" /> Raw Material
            </Button>
            <Button size="sm" onClick={() => openModal("createBatch")}>
              <Plus className="w-4 h-4 mr-1" /> New Batch
            </Button>
          </div>
        </div>

        {/* ── Batches Tab ── */}
        <TabsContent value="batches" className="space-y-4">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            {["", ...BATCH_STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {s === "" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>

          {batchesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (batches?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Factory className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No production batches found</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => openModal("createBatch")}
                >
                  Create first batch
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {batches?.map((batch, i) => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  index={i}
                  productName={products?.find((p) => p.id === batch.product_id)?.name ?? "Unknown"}
                  onStatusChange={(status) => onUpdateStatus(batch.id, status)}
                  loading={updateBatchStatus.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Raw Materials Tab ── */}
        <TabsContent value="materials" className="space-y-3">
          {rawMatsLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
          ) : (rawMaterials?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No raw materials tracked yet</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => openModal("createRawMaterial")}
                >
                  Add first material
                </Button>
              </CardContent>
            </Card>
          ) : (
            rawMaterials?.map((mat, i) => (
              <RawMaterialRow key={mat.id} material={mat} index={i} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create Batch Dialog ── */}
      <Dialog open={modals["createBatch"]} onOpenChange={(o) => !o && closeModal("createBatch")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Production Batch</DialogTitle>
          </DialogHeader>
          <form onSubmit={batchForm.handleSubmit(onCreateBatch)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Batch Number *</Label>
                <Input {...batchForm.register("batch_number")} placeholder="e.g. BATCH-2025-001" />
                {batchForm.formState.errors.batch_number && (
                  <p className="text-xs text-destructive">{batchForm.formState.errors.batch_number.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Planned Qty *</Label>
                <Input
                  type="number"
                  step="0.001"
                  {...batchForm.register("planned_quantity", { valueAsNumber: true })}
                  placeholder="e.g. 500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Select onValueChange={(v) => batchForm.setValue("product_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {batchForm.formState.errors.product_id && (
                <p className="text-xs text-destructive">{batchForm.formState.errors.product_id.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" {...batchForm.register("start_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Target End Date</Label>
                <Input type="date" {...batchForm.register("end_date")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...batchForm.register("notes")} placeholder="Optional batch notes..." rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => closeModal("createBatch")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBatch.isPending}>
                {createBatch.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Create Batch
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Raw Material Dialog ── */}
      <Dialog open={modals["createRawMaterial"]} onOpenChange={(o) => !o && closeModal("createRawMaterial")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Raw Material</DialogTitle>
          </DialogHeader>
          <form onSubmit={rawMatForm.handleSubmit(onCreateRawMaterial)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Material Name *</Label>
                <Input {...rawMatForm.register("name")} placeholder="e.g. Rose Extract" />
                {rawMatForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{rawMatForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select
                  defaultValue="kg"
                  onValueChange={(v) => rawMatForm.setValue("unit", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["kg", "g", "L", "ml", "pcs", "box"].map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  step="0.001"
                  {...rawMatForm.register("current_stock", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  step="0.001"
                  {...rawMatForm.register("reorder_level", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost / Unit (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...rawMatForm.register("cost_per_unit", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Supplier</Label>
                <Input {...rawMatForm.register("supplier")} placeholder="Optional supplier name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...rawMatForm.register("notes")} rows={2} placeholder="Optional notes..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => closeModal("createRawMaterial")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRawMaterial.isPending}>
                {createRawMaterial.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Add Material
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function BatchCard({
  batch,
  index,
  productName,
  onStatusChange,
  loading,
}: {
  batch: ProductionBatch;
  index: number;
  productName: string;
  onStatusChange: (status: string) => void;
  loading: boolean;
}) {
  const progress = batch.planned_quantity > 0
    ? Math.round((batch.produced_quantity / batch.planned_quantity) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {getBatchStatusIcon(batch.status)}
                <p className="text-sm font-semibold">{batch.batch_number}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{productName}</p>
            </div>
            <Badge className={cn("text-[10px] px-2 py-0.5 border-0 capitalize", getStatusColor(batch.status))}>
              {batch.status.replace("_", " ")}
            </Badge>
          </div>

          {/* Quantity / Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Production Progress</span>
              <span className="font-medium">
                {batch.produced_quantity} / {batch.planned_quantity} units
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{progress}% complete</span>
              {batch.end_date && <span>Due {formatDate(batch.end_date)}</span>}
            </div>
          </div>

          {/* Dates */}
          {(batch.start_date || batch.end_date) && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              {batch.start_date && <span>Start: {formatDate(batch.start_date)}</span>}
              {batch.end_date && <span>End: {formatDate(batch.end_date)}</span>}
            </div>
          )}

          {/* Notes */}
          {batch.notes && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
              {batch.notes}
            </p>
          )}

          {/* Status Actions */}
          {batch.status !== "completed" && batch.status !== "rejected" && (
            <div className="flex gap-2 pt-1">
              {batch.status === "planned" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400"
                  onClick={() => onStatusChange("in_progress")}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Start Production
                </Button>
              )}
              {batch.status === "in_progress" && (
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => onStatusChange("completed")}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                  Mark Completed
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-red-300 text-red-600 dark:border-red-800 dark:text-red-400"
                onClick={() => onStatusChange("rejected")}
                disabled={loading}
              >
                Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RawMaterialRow({ material, index }: { material: RawMaterial; index: number }) {
  const pct = material.reorder_level > 0
    ? Math.min(100, Math.round((material.current_stock / (material.reorder_level * 3)) * 100))
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className={cn(material.is_low_stock && "border-orange-200 dark:border-orange-800")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium truncate">{material.name}</p>
                {material.is_low_stock && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300 dark:border-orange-700 dark:text-orange-400 shrink-0"
                  >
                    Low
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Progress value={pct} className={cn("h-1.5 flex-1", material.is_low_stock ? "[&>div]:bg-orange-500" : "[&>div]:bg-green-500")} />
                <span className="text-xs font-medium shrink-0 text-muted-foreground">
                  {material.current_stock} / {material.reorder_level} {material.unit}
                </span>
              </div>
              {material.supplier && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Supplier: {material.supplier}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium">₹{material.cost_per_unit}/{material.unit}</p>
              <p className="text-[10px] text-muted-foreground">per unit</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
