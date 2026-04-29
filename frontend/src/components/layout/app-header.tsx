"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Box, ClipboardList, FileText, Menu, Moon, Search, Sun, User, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { clientFetch } from "@/lib/api-client";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tasks",
  "/finance": "Finance",
  "/inventory": "Inventory",
  "/employees": "Employees",
  "/payroll": "Payroll",
  "/production": "Production",
  "/reports": "Reports",
  "/roles": "Roles & Access",
  "/profile": "My Profile",
  "/records": "Activity Records",
};

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const typeIcon: Record<string, React.ElementType> = {
  task: ClipboardList,
  employee: User,
  product: Box,
  invoice: FileText,
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar, notificationCount } = useUIStore();
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await clientFetch<{ results: SearchResult[] }>(`/search/?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.results);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  const title = PAGE_TITLES[pathname] ?? "Backero COS";

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [searchOpen]);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
      {/* Left: menu + title (hidden when search is open on mobile) */}
      <div className={cn("flex items-center gap-4", searchOpen && "hidden sm:flex")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-foreground text-lg leading-tight">{title}</h1>
          <p className="text-muted-foreground text-xs capitalize">
            {user?.role} · {user?.designation ?? ""}
          </p>
        </div>
      </div>

      {/* Search bar (expands inline) */}
      {searchOpen ? (
        <div className="flex items-center gap-2 flex-1 sm:flex-initial sm:w-80 mx-2 relative">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, employees, products…"
              className="w-full h-9 pl-9 pr-4 rounded-md border border-input bg-background text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {/* Results dropdown */}
            {(searchResults.length > 0 || searchLoading) && (
              <div className="absolute top-10 left-0 right-0 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {searchLoading && (
                  <div className="px-4 py-3 text-xs text-muted-foreground">Searching…</div>
                )}
                {!searchLoading && searchResults.map((r) => {
                  const Icon = typeIcon[r.type] ?? Search;
                  return (
                    <button
                      key={r.id}
                      onClick={() => { router.push(r.href); setSearchOpen(false); setSearchQuery(""); }}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                      <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">{r.type}</span>
                    </button>
                  );
                })}
                {!searchLoading && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground">No results for "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
            title="Close search"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {!searchOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => setSearchOpen(true)}
            title="Search"
          >
            <Search className="w-4 h-4" />
          </Button>
        )}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Button>
        <div className="ml-2 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
          <span className="text-primary text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </span>
        </div>
      </div>
    </header>
  );
}
