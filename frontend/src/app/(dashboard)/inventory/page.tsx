"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Box,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdjustStock,
  useCreatePlatformOrder,
  useCreateProduct,
  usePlatformSummary,
  useProducts,
} from "@/hooks/use-queries";
import {
  cn,
  formatCurrency,
  formatDate,
  getPlatformColor,
  getStockPercent,
} from "@/lib/utils";
import type { Product } from "@/types";
import { useUIStore } from "@/stores/ui-store";
import { format } from "date-fns";

// ── Schemas ───────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(2, "Name required"),
  sku: z.string().min(1, "SKU required"),
  category: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().default("pcs"),
  mrp: z.number().min(0),
  cost_price: z.number().min(0),
  gst_rate: z.number().min(0).max(28),
  hsn_code: z.string().optional(),
  reorder_level: z.number().min(0),
  max_stock: z.number().min(1),
});

const adjustSchema = z.object({
  quantity: z.number(),
  reason: z.string().min(2, "Reason required"),
});

const platformOrderSchema = z.object({
  platform: z.enum(["amazon", "flipkart", "meesho", "website", "offline"]),
  order_id: z.string().min(1, "Order ID required"),
  product_name: z.string().min(1, "Product name required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  amount: z.number().min(0, "Amount required"),
  status: z.enum(["pending", "shipped", "delivered", "returned", "cancelled"]).default("pending"),
  order_date: z.string().min(1, "Order date required"),
});

type ProductForm = z.infer<typeof productSchema>;
type AdjustForm = z.infer<typeof adjustSchema>;
type PlatformOrderForm = z.infer<typeof platformOrderSchema>;

// ── Page Component ────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { modals, openModal, closeModal } = useUIStore();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Queries
  const { data: products, isLoading: productsLoading } = useProducts({
    category: categoryFilter || undefined,
  });
  const { data: platformSummary, isLoading: platformLoading } =
    usePlatformSummary(todayStr);

  // Mutations
  const createProduct = useCreateProduct();
  const adjustStock = useAdjustStock();
  const createPlatformOrder = useCreatePlatformOrder();

  // Forms
  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      unit: "pcs",
      mrp: 0,
      cost_price: 0,
      gst_rate: 18,
      reorder_level: 10,
      max_stock: 1000,
    },
  });

  const adjustForm = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { quantity: 0, reason: "" },
  });

  const platformOrderForm = useForm<PlatformOrderForm>({
    resolver: zodResolver(platformOrderSchema),
    defaultValues: {
      platform: "amazon",
      order_id: "",
      product_name: "",
      quantity: 1,
      amount: 0,
      status: "pending",
      order_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  // Derived data
  const lowStockProducts = products?.filter((p) => p.is_low_stock) ?? [];
  const categories = Array.from(
    new Set(products?.map((p) => p.category).filter(Boolean)),
  ) as string[];

  // Handlers
  async function onCreateProduct(data: ProductForm) {
    await createProduct.mutateAsync(data as Record<string, unknown>);
    productForm.reset();
    closeModal("createProduct");
  }

  async function onAdjustStock(data: AdjustForm) {
    if (!selectedProduct) return;
    await adjustStock.mutateAsync({
      id: selectedProduct.id,
      quantity: data.quantity,
      reason: data.reason,
    });
    adjustForm.reset();
    setSelectedProduct(null);
    closeModal("adjustStock");
  }

  function openAdjustModal(product: Product) {
    setSelectedProduct(product);
    adjustForm.reset();
    openModal("adjustStock");
  }

  async function onLogPlatformOrder(data: PlatformOrderForm) {
    await createPlatformOrder.mutateAsync(data as Record<string, unknown>);
    platformOrderForm.reset({
      platform: "amazon",
      order_id: "",
      product_name: "",
      quantity: 1,
      amount: 0,
      status: "pending",
      order_date: format(new Date(), "yyyy-MM-dd"),
    });
    closeModal("logOrder");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full flex-1">
      {/* ── Low Stock Alert Banner ── */}
      <AnimatePresence>
        {lowStockProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  {lowStockProducts.length} product
                  {lowStockProducts.length > 1 ? "s" : ""} running low on stock
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                  {lowStockProducts.map((p) => p.name).join(", ")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 shrink-0"
                onClick={() => setCategoryFilter("")}
              >
                View All
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Today's Platform Order Summary ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Today's Orders by Platform
          </h3>
          <Button size="sm" variant="outline" onClick={() => openModal("logOrder")}>
            <Plus className="w-4 h-4 mr-1.5" /> Log Order
          </Button>
        </div>
        {platformLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : platformSummary && platformSummary.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {platformSummary.map((ps, i) => (
              <motion.div
                key={ps.platform}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07, duration: 0.3 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          getPlatformColor(ps.platform),
                        )}
                      />
                      <span className="text-xs font-semibold capitalize text-foreground">
                        {ps.platform}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-foreground leading-none">
                      {ps.orders}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      orders today
                    </p>
                    <p className="text-sm font-medium text-primary mt-2">
                      {formatCurrency(ps.revenue)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {ps.units} units sold
                    </p>
                  </CardContent>
                  <div className={cn("h-1", getPlatformColor(ps.platform))} />
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No platform orders logged today
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Products Section ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-base">Products & Stock</h3>
            <p className="text-muted-foreground text-sm">
              {products?.length ?? 0} products ·{" "}
              <span className="text-orange-500">
                {lowStockProducts.length} low stock
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Category filter */}
            <Select
              value={categoryFilter || "all"}
              onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => openModal("createProduct")}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Product
            </Button>
          </div>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No products found</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => openModal("createProduct")}
              >
                Add your first product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products?.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                index={i}
                onAdjust={() => openAdjustModal(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create Product Dialog ── */}
      <Dialog
        open={modals["createProduct"]}
        onOpenChange={(o) => !o && closeModal("createProduct")}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={productForm.handleSubmit(onCreateProduct)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Product Name *</Label>
                <Input
                  {...productForm.register("name")}
                  placeholder="e.g. Rose Face Cream 50g"
                />
                {productForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {productForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>SKU *</Label>
                <Input
                  {...productForm.register("sku")}
                  placeholder="e.g. RFC-50G"
                />
                {productForm.formState.errors.sku && (
                  <p className="text-xs text-destructive">
                    {productForm.formState.errors.sku.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  {...productForm.register("category")}
                  placeholder="e.g. Face Care"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select
                  defaultValue="pcs"
                  onValueChange={(v) => productForm.setValue("unit", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["pcs", "ml", "g", "kg", "L", "box", "set"].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>HSN Code</Label>
                <Input
                  {...productForm.register("hsn_code")}
                  placeholder="e.g. 33049990"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>MRP (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...productForm.register("mrp", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...productForm.register("cost_price", {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>GST Rate (%)</Label>
                <Select
                  defaultValue="18"
                  onValueChange={(v) =>
                    productForm.setValue("gst_rate", Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 12, 18, 28].map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        {g}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  {...productForm.register("reorder_level", {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Stock</Label>
                <Input
                  type="number"
                  {...productForm.register("max_stock", {
                    valueAsNumber: true,
                  })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                {...productForm.register("description")}
                placeholder="Optional product description..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeModal("createProduct")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                )}
                Create Product
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Log Platform Order Dialog ── */}
      <Dialog
        open={modals["logOrder"]}
        onOpenChange={(o) => !o && closeModal("logOrder")}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Platform Order</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={platformOrderForm.handleSubmit(onLogPlatformOrder)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Platform *</Label>
                <Select
                  defaultValue="amazon"
                  onValueChange={(v) =>
                    platformOrderForm.setValue(
                      "platform",
                      v as PlatformOrderForm["platform"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["amazon", "flipkart", "meesho", "website", "offline"] as const).map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Order ID *</Label>
                <Input
                  {...platformOrderForm.register("order_id")}
                  placeholder="e.g. AMZ-12345"
                />
                {platformOrderForm.formState.errors.order_id && (
                  <p className="text-xs text-destructive">
                    {platformOrderForm.formState.errors.order_id.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Product Name *</Label>
              <Input
                {...platformOrderForm.register("product_name")}
                placeholder="e.g. Rose Face Cream 50g"
              />
              {platformOrderForm.formState.errors.product_name && (
                <p className="text-xs text-destructive">
                  {platformOrderForm.formState.errors.product_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  {...platformOrderForm.register("quantity", { valueAsNumber: true })}
                />
                {platformOrderForm.formState.errors.quantity && (
                  <p className="text-xs text-destructive">
                    {platformOrderForm.formState.errors.quantity.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...platformOrderForm.register("amount", { valueAsNumber: true })}
                />
                {platformOrderForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">
                    {platformOrderForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  defaultValue="pending"
                  onValueChange={(v) =>
                    platformOrderForm.setValue(
                      "status",
                      v as PlatformOrderForm["status"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["pending", "shipped", "delivered", "returned", "cancelled"] as const).map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Order Date *</Label>
                <Input
                  type="date"
                  {...platformOrderForm.register("order_date")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeModal("logOrder")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createPlatformOrder.isPending}>
                {createPlatformOrder.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                )}
                Log Order
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Adjust Stock Dialog ── */}
      <Dialog
        open={modals["adjustStock"]}
        onOpenChange={(o) => !o && closeModal("adjustStock")}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {/* Product info */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-semibold">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedProduct.sku}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-bold text-foreground">
                    Current: {selectedProduct.current_stock}{" "}
                    {selectedProduct.unit}
                  </span>
                  {selectedProduct.is_low_stock && (
                    <Badge
                      variant="destructive"
                      className="text-[10px] px-1.5 py-0"
                    >
                      Low Stock
                    </Badge>
                  )}
                </div>
                <div className="mt-2">
                  <Progress
                    value={getStockPercent(
                      selectedProduct.current_stock,
                      selectedProduct.max_stock,
                    )}
                    className="h-1.5"
                  />
                </div>
              </div>

              <form
                onSubmit={adjustForm.handleSubmit(onAdjustStock)}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label>Quantity Change</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        adjustForm.setValue(
                          "quantity",
                          -Math.abs(adjustForm.getValues("quantity")),
                        )
                      }
                    >
                      <ArrowDownCircle className="w-4 h-4 text-red-500" />
                    </Button>
                    <Input
                      type="number"
                      step="0.001"
                      {...adjustForm.register("quantity", {
                        valueAsNumber: true,
                      })}
                      className="text-center font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        adjustForm.setValue(
                          "quantity",
                          Math.abs(adjustForm.getValues("quantity")),
                        )
                      }
                    >
                      <ArrowUpCircle className="w-4 h-4 text-green-500" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Positive = add stock · Negative = remove stock
                  </p>
                  {adjustForm.formState.errors.quantity && (
                    <p className="text-xs text-destructive">
                      {adjustForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Reason *</Label>
                  <Input
                    {...adjustForm.register("reason")}
                    placeholder="e.g. Stock received from supplier"
                  />
                  {adjustForm.formState.errors.reason && (
                    <p className="text-xs text-destructive">
                      {adjustForm.formState.errors.reason.message}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedProduct(null);
                      closeModal("adjustStock");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={adjustStock.isPending}>
                    {adjustStock.isPending && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    )}
                    Adjust Stock
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  index,
  onAdjust,
}: {
  product: Product;
  index: number;
  onAdjust: () => void;
}) {
  const stockPct = getStockPercent(product.current_stock, product.max_stock);
  const isLow = product.is_low_stock;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      whileHover={{ y: -2 }}
    >
      <Card
        className={cn(
          "overflow-hidden transition-shadow hover:shadow-md",
          isLow && "border-orange-200 dark:border-orange-800",
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">
                {product.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {product.sku}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {product.category && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 capitalize"
                >
                  {product.category}
                </Badge>
              )}
              {isLow && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300 dark:border-orange-700 dark:text-orange-400"
                >
                  Low Stock
                </Badge>
              )}
            </div>
          </div>

          {/* Stock Level */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Stock Level</span>
              <span
                className={cn(
                  "font-semibold",
                  isLow ? "text-orange-500" : "text-foreground",
                )}
              >
                {product.current_stock} / {product.max_stock} {product.unit}
              </span>
            </div>
            <Progress
              value={stockPct}
              className={cn(
                "h-2 rounded-full",
                isLow
                  ? "[&>div]:bg-orange-500"
                  : stockPct > 60
                    ? "[&>div]:bg-green-500"
                    : "[&>div]:bg-yellow-500",
              )}
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                Reorder at {product.reorder_level} {product.unit}
              </span>
              <span>{stockPct}%</span>
            </div>
          </div>

          {/* Price Row */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">MRP</p>
              <p className="text-sm font-bold text-foreground">
                {formatCurrency(product.mrp)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Cost</p>
              <p className="text-sm font-medium text-muted-foreground">
                {formatCurrency(product.cost_price)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">GST</p>
              <p className="text-sm font-medium">{product.gst_rate}%</p>
            </div>
          </div>

          {/* Actions */}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={onAdjust}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Adjust Stock
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
