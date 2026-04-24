"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, Receipt, Search, Users, ClipboardList, X } from "lucide-react";
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
    api.tasks.list({ search: q }).then((tasks) => {
      tasks.slice(0, 3).forEach((t) =>
        results.push({ id: `task-${t.id}`, label: t.title, sub: `Task · ${t.priority} · ${t.status}`, href: "/tasks", icon: <ClipboardList className="w-4 h-4 text-purple-500" /> })
      );
    }),
    api.inventory.products.list({ category: undefined }).then((products) => {
      products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 3).forEach((p) =>
          results.push({ id: `product-${p.id}`, label: p.name, sub: `Product · SKU: ${p.sku}`, href: "/inventory", icon: <Package className="w-4 h-4 text-green-500" /> })
        );
    }),
    api.employees.list({ is_active: true }).then((employees) => {
      employees.filter(e => e.name.toLowerCase().includes(q.toLowerCase()) || e.phone.includes(q))
        .slice(0, 3).forEach((e) =>
          results.push({ id: `emp-${e.id}`, label: e.name, sub: `Employee · ${e.role} · ${e.designation ?? ""}`, href: "/employees", icon: <Users className="w-4 h-4 text-blue-500" /> })
        );
    }),
    api.finance.invoices.list({ status: undefined }).then((invoices) => {
      invoices.filter(i => i.invoice_number.toLowerCase().includes(q.toLowerCase()) || i.customer_name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 3).forEach((i) =>
          results.push({ id: `inv-${i.id}`, label: i.invoice_number, sub: `Invoice · ${i.customer_name} · ₹${i.total.toLocaleString("en-IN")}`, href: "/finance", icon: <Receipt className="w-4 h-4 text-orange-500" /> })
        );
    }),
  ]);
  return results;
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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchAll(query)); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && results[selected]) navigate(results[selected].href);
    else if (e.key === "Escape") onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          {loading ? <Loader2 className="w-4 h-4 text-slate-400 shrink-0 animate-spin" /> : <Search className="w-4 h-4 text-slate-400 shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, products, employees, invoices…"
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="py-2 max-h-72 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => navigate(r.href)}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  selected === i ? "bg-primary/8 dark:bg-primary/15" : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  selected === i ? "bg-primary/10" : "bg-slate-100 dark:bg-slate-800")}>
                  {r.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.label}</p>
                  <p className="text-xs text-slate-500 truncate">{r.sub}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No results for "{query}"</p>
          </div>
        )}

        {!query && (
          <div className="px-4 py-4 text-xs text-slate-400 space-y-1">
            <p>Search across tasks, products, employees, and invoices.</p>
            <p>Use <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↑↓</kbd> to navigate, <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded">↵</kbd> to open.</p>
          </div>
        )}
      </div>
    </div>
  );
}
