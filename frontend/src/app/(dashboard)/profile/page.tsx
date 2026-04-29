"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Briefcase,
  Check,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { api, handleApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Module } from "@/types";

const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  tasks: "Tasks",
  finance: "Finance",
  inventory: "Inventory",
  employees: "Employees",
  production: "Production",
  reports: "Reports",
  roles: "Roles & Access",
  records: "Activity Records",
};

// Human-readable description of what each permission level means per module
const MODULE_ACTIONS: Record<
  Module,
  { view: string; create: string; edit: string }
> = {
  dashboard: {
    view: "See KPIs, charts and business overview",
    create: "",
    edit: "",
  },
  tasks: {
    view: "Browse all tasks and their current status",
    create: "Create new tasks and assign them to team members",
    edit: "Update task status, priority and details",
  },
  finance: {
    view: "View transactions, invoices and financial summaries",
    create: "Log new entries and generate invoices",
    edit: "Modify existing financial records",
  },
  inventory: {
    view: "Browse products, stock levels and order history",
    create: "Add new products and log purchase orders",
    edit: "Adjust stock quantities and product details",
  },
  employees: {
    view: "View employee profiles and attendance",
    create: "Add new employees and create departments",
    edit: "Update employee details, roles and attendance",
  },
  production: {
    view: "Track production batches and raw materials",
    create: "Create new batches and add raw materials",
    edit: "Update batch status and adjust material quantities",
  },
  reports: {
    view: "Access all reports, analytics and export data",
    create: "",
    edit: "",
  },
  roles: {
    view: "View existing roles and their permission settings",
    create: "Create new roles with custom permissions",
    edit: "Modify role names, colors and permissions",
  },
  records: {
    view: "View the full activity audit trail",
    create: "",
    edit: "Restore deleted records",
  },
};

export default function ProfilePage() {
  const { user, updateUser, permissions } = useAuthStore();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [designation, setDesignation] = useState(user?.designation ?? "");

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.profile.update({ name, email, designation }),
    onSuccess: (updated) => {
      updateUser(updated);
      toast.success("Profile updated");
    },
    onError: handleApiError,
  });

  const isDirty =
    name !== (user?.name ?? "") ||
    email !== (user?.email ?? "") ||
    designation !== (user?.designation ?? "");

  const accessibleModules = (
    Object.entries(permissions) as [
      Module,
      { can_view: boolean; can_create: boolean; can_edit: boolean },
    ][]
  ).filter(([, p]) => p.can_view);

  return (
    <div className="space-y-6">
      {/* ── Profile header ── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-5 flex-wrap">
          <Avatar className="w-20 h-20 shrink-0">
            <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.name} />
            <AvatarFallback className="bg-primary/15 text-primary font-bold text-2xl">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground">
              {user?.name}
            </h1>
            {user?.designation && (
              <p className="text-sm text-muted-foreground">
                {user.designation}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge
                variant="secondary"
                className="gap-1.5 text-xs font-medium"
              >
                <ShieldCheck className="w-3 h-3" />
                {user?.role}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {user?.phone}
              </span>
              {user?.email && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: form cards ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Personal Information */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">
                Personal Information
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (login)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={user?.phone ?? ""}
                    disabled
                    className="pl-10 opacity-60"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Phone cannot be changed
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="designation">Designation</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="designation"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="pl-10"
                    placeholder="e.g. Senior Manager"
                  />
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-3 border-t border-border">
              <Button
                onClick={() => mutate(undefined)}
                disabled={!isDirty || isPending}
                className="gap-2 mt-4"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </Button>
              {isDirty && (
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => {
                    setName(user?.name ?? "");
                    setEmail(user?.email ?? "");
                    setDesignation(user?.designation ?? "");
                  }}
                >
                  Discard
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: My Access ── */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 sticky top-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">What I Can Do</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Your permissions as{" "}
              <span className="font-medium text-foreground">{user?.role}</span>
            </p>

            {accessibleModules.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No module access assigned.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {accessibleModules.map(([module, p]) => {
                  const actions = MODULE_ACTIONS[module];
                  const rows: { label: string; allowed: boolean }[] = [
                    { label: actions.view, allowed: p.can_view },
                    { label: actions.create, allowed: p.can_create },
                    { label: actions.edit, allowed: p.can_edit },
                  ].filter((r) => r.label); // skip empty strings (e.g. dashboard has no create/edit)

                  return (
                    <div
                      key={module}
                      className="rounded-lg  border border-border bg-muted/20 p-3 space-y-2"
                    >
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        {MODULE_LABELS[module]}
                      </p>
                      <div className="space-y-1.5">
                        {rows.map(({ label, allowed }) => (
                          <div key={label} className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                allowed
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground/40"
                              }`}
                            >
                              {allowed ? (
                                <Check className="w-2.5 h-2.5" />
                              ) : (
                                <X className="w-2.5 h-2.5" />
                              )}
                            </span>
                            <span
                              className={`text-xs leading-snug ${
                                allowed
                                  ? "text-foreground"
                                  : "text-muted-foreground/50 line-through"
                              }`}
                            >
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
