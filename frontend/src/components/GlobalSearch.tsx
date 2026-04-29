
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  Package,
  Receipt,
  Search,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  href: string;
  icon: React.ReactNode;
}

async function searchAll(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const results: SearchResult[] = [];
  await Promise.allSettled([
    api.tasks.list({ search: q, limit: 3 }).then((res) => {
      res.items.slice(0, 3).forEach((t) =>
        results.push({
          id: `task-${t.id}`,
          label: t.title,
          sub: `Task · ${t.priority} · ${t.status}`,
          href: "/tasks",
          icon: <ClipboardList className="w-4 h-4 text-purple-500" />,
        })
      );
    }),
    api.inventory.products.list({ search: q, limit: 3 }).then((res) => {
      res.items
        .slice(0, 3)
        .forEach((p) =>
          results.push({
            id: `product-${p.id}`,
            label: p.name,
            sub: `Product · SKU: ${p.sku}`,
            href: "/inventory",
            icon: <Package className="w-4 h-4 text-green-500" />,
          })
        );
    }),
    api.employees.list({ search: q, limit: 3 }).then((res) => {
      res.items
        .slice(0, 3)
        .forEach((e) =>
          results.push({
            id: `emp-${e.id}`,
            label: e.name,
            sub: `Employee · ${e.role} · ${e.designation ?? ""}`,
            href: "/employees",
            icon: <Users className="w-4 h-4 text-blue-500" />,
          })
        );
    }),
    api.finance.invoices.list({ search: q, limit: 3 }).then((res) => {
      res.items
        .slice(0, 3)
        .forEach((i) =>
          results.push({
            id: `inv-${i.id}`,
            label: i.invoice_number,
            sub: `Invoice · ${i.customer_name} · ₹${i.total.toLocaleString("en-IN")}`,
            href: "/finance",
            icon: <Receipt className="w-4 h-4 text-orange-500" />,
          })
        );
    }),
  ]);
  return results;
}

const QUICK_LINKS = [
  { label: "Tasks", icon: ClipboardList, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10", href: "/tasks" },
  { label: "Inventory", icon: Package, color: "text-green-600", bg: "bg-green-50 dark:bg-green-500/10", href: "/inventory" },
  { label: "Employees", icon: Users, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", href: "/employees" },
  { label: "Finance", icon: Receipt, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10", href: "/finance" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.07] border border-slate-200 dark:border-white/[0.1] rounded font-mono leading-none">
      {children}
    </kbd>
  );
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchAll(query));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      navigate(results[selected].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[9vh] px-4 pointer-events-none">
            <motion.div
              key="dialog"
              className="w-full max-w-[560px] pointer-events-auto"
              initial={{ opacity: 0, scale: 0.96, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
            >
              {/* Shell */}
              <div
                className="bg-white dark:bg-[#13161d] rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08]"
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(77,135,49,0.07), 0 8px 32px rgba(0,0,0,0.14), 0 32px 72px rgba(0,0,0,0.16)",
                }}
              >
                {/* ── Input row ── */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="shrink-0 text-slate-400">
                    {loading ? (
                      <Loader2 className="w-[18px] h-[18px] animate-spin" />
                    ) : (
                      <Search className="w-[18px] h-[18px]" />
                    )}
                  </div>

                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search tasks, products, employees, invoices…"
                    className="flex-1 bg-transparent text-[14px] text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />

                  <div className="flex items-center gap-1.5 shrink-0">
                    {query && (
                      <button
                        onClick={() => {
                          setQuery("");
                          setResults([]);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <Kbd>Esc</Kbd>
                  </div>
                </div>

                {/* Separator */}
                <div className="h-px bg-slate-100 dark:bg-white/[0.06]" />

                {/* ── Results ── */}
                <AnimatePresence mode="wait">
                  {results.length > 0 && (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="overflow-y-auto max-h-[320px] py-1.5"
                    >
                      {results.map((r, i) => (
                        <motion.button
                          key={r.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.025, duration: 0.18 }}
                          onClick={() => navigate(r.href)}
                          onMouseEnter={() => setSelected(i)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            selected === i
                              ? "bg-[#4d8731]/[0.07] dark:bg-[#4d8731]/[0.13]"
                              : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                          )}
                        >
                          {/* Icon badge */}
                          <div
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                              selected === i
                                ? "bg-[#4d8731]/[0.1] dark:bg-[#4d8731]/[0.18]"
                                : "bg-slate-100 dark:bg-white/[0.06]"
                            )}
                          >
                            {r.icon}
                          </div>

                          {/* Text */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate leading-snug">
                              {r.label}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {r.sub}
                            </p>
                          </div>

                          {/* Enter hint */}
                          <motion.div
                            animate={{ opacity: selected === i ? 1 : 0, x: selected === i ? 0 : -4 }}
                            transition={{ duration: 0.12 }}
                            className="shrink-0"
                          >
                            <Kbd>↵</Kbd>
                          </motion.div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  {/* ── No results ── */}
                  {query && !loading && results.length === 0 && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="py-12 flex flex-col items-center gap-2"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center mb-1">
                        <Search className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        No results for{" "}
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          &ldquo;{query}&rdquo;
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Try searching with a different term
                      </p>
                    </motion.div>
                  )}

                  {/* ── Quick-jump (empty query) ── */}
                  {!query && (
                    <motion.div
                      key="quickjump"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      className="px-4 pt-3 pb-4"
                    >
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
                        Quick jump
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_LINKS.map((item, i) => (
                          <motion.button
                            key={item.href}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.18 }}
                            onClick={() => navigate(item.href)}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left",
                              "border border-slate-100 dark:border-white/[0.06]",
                              "bg-slate-50 dark:bg-white/[0.03]",
                              "hover:bg-slate-100 dark:hover:bg-white/[0.07]",
                              "hover:border-slate-200 dark:hover:border-white/[0.1]",
                              "transition-all duration-150 group"
                            )}
                          >
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                              <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                            </div>
                            <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300 flex-1">
                              {item.label}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150" />
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Footer ── */}
                <div className="h-px bg-slate-100 dark:bg-white/[0.06]" />
                <div className="flex items-center gap-4 px-4 py-2">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    <Kbd>↵</Kbd>
                    Open
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    <Kbd>Esc</Kbd>
                    Close
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
