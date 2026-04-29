"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  ShieldCheck,
  Loader2,
  Save,
  Trash2,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { api, handleApiError, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import type { Module, ModuleAccess, RoleDetail } from "@/types";

const MODULES: Module[] = [
  "dashboard",
  "tasks",
  "finance",
  "inventory",
  "employees",
  "production",
  "reports",
  "roles",
];

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

const PRESET_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#d97706",
  "#059669",
  "#dc2626",
  "#0891b2",
  "#64748b",
  "#be185d",
];

type DraftPerms = Partial<Record<Module, ModuleAccess>>;

function emptyPerms(): DraftPerms {
  return {};
}

function roleToPerms(role: RoleDetail): DraftPerms {
  const map: DraftPerms = {};
  for (const p of role.permissions) {
    map[p.module as Module] = {
      can_view: p.can_view,
      can_create: p.can_create,
      can_edit: p.can_edit,
    };
  }
  return map;
}

// ── Permission cell toggle ────────────────────────────────────────────────────
function PermCell({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onChange}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
        checked ? "bg-primary border-primary" : "border-border bg-background"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-primary/60 cursor-pointer"}`}
    >
      {checked && (
        <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
      )}
    </button>
  );
}

// ── Permission Matrix ─────────────────────────────────────────────────────────
function PermissionMatrix({
  perms,
  isSystem,
  onChange,
}: {
  perms: DraftPerms;
  isSystem: boolean;
  onChange: (perms: DraftPerms) => void;
}) {
  function toggle(module: Module, field: keyof ModuleAccess) {
    const current = perms[module] ?? {
      can_view: false,
      can_create: false,
      can_edit: false,
    };
    const next = { ...current, [field]: !current[field] };
    // If view is turned off, also turn off create and edit
    if (field === "can_view" && !next.can_view) {
      next.can_create = false;
      next.can_edit = false;
    }
    // If create or edit are turned on, also turn on view
    if ((field === "can_create" || field === "can_edit") && next[field]) {
      next.can_view = true;
    }
    onChange({ ...perms, [module]: next });
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
              Module
            </th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground w-16">
              View
            </th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground w-16">
              Create
            </th>
            <th className="px-3 py-2 text-center font-medium text-muted-foreground w-16">
              Edit
            </th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod, i) => {
            const p = perms[mod] ?? {
              can_view: false,
              can_create: false,
              can_edit: false,
            };
            return (
              <tr
                key={mod}
                className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {MODULE_LABELS[mod]}
                </td>
                <td className="px-3 py-2">
                  <PermCell
                    checked={isSystem || p.can_view}
                    disabled={isSystem}
                    onChange={() => toggle(mod, "can_view")}
                  />
                </td>
                <td className="px-3 py-2">
                  <PermCell
                    checked={isSystem || p.can_create}
                    disabled={isSystem}
                    onChange={() => toggle(mod, "can_create")}
                  />
                </td>
                <td className="px-3 py-2">
                  <PermCell
                    checked={isSystem || p.can_edit}
                    disabled={isSystem}
                    onChange={() => toggle(mod, "can_edit")}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Role form dialog ──────────────────────────────────────────────────────────
function RoleDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: RoleDetail;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [color, setColor] = useState(existing?.color ?? "#6366f1");
  const [perms, setPerms] = useState<DraftPerms>(
    existing ? roleToPerms(existing) : emptyPerms(),
  );
  const [nameError, setNameError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      isEdit
        ? api.roles.update(existing!.id, {
            name,
            description,
            color,
            permissions: perms,
          })
        : api.roles.create({ name, description, color, permissions: perms }),
    onSuccess: () => {
      toast.success(isEdit ? "Role updated" : "Role created");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.field === "name") {
        setNameError(error.message);
      } else {
        handleApiError(error);
      }
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-[540px]">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Role" : "New Role"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update role details and module permissions."
              : "Define a new role and its access permissions."}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              placeholder="e.g. Sales Manager"
              disabled={existing?.is_system}
              className={
                nameError
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this role"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                title="Custom color"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Permissions</Label>
            {existing?.is_system && (
              <p className="text-xs text-muted-foreground mb-2">
                System roles always have full access and cannot be restricted.
              </p>
            )}
            <PermissionMatrix
              perms={perms}
              isSystem={existing?.is_system ?? false}
              onChange={setPerms}
            />
          </div>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            disabled={!name.trim() || isPending}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const queryClient = useQueryClient();
  const [dialogRole, setDialogRole] = useState<RoleDetail | null | "new">(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.roles.list(),
  });

  const { mutate: deleteRole } = useMutation({
    mutationFn: (id: string) => api.roles.delete(id),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: handleApiError,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Roles & Access
            </h1>
            <p className="text-sm text-muted-foreground">
              Create roles and define what each role can view, create, or edit.
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogRole("new")} className="gap-2">
          <Plus className="w-4 h-4" />
          New Role
        </Button>
      </div>

      {/* Role cards */}
      <div className="grid gap-4">
        {roles.map((role) => {
          const moduleCount = role.permissions.filter((p) => p.can_view).length;
          return (
            <div
              key={role.id}
              className="rounded-xl border border-border bg-card p-5 flex items-start gap-4"
            >
              {/* Color dot */}
              <div
                className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: role.color }}
              >
                {role.name[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground">
                    {role.name}
                  </span>
                  {role.is_system && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-purple-600 border-purple-200 bg-purple-50"
                    >
                      System
                    </Badge>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {role.description}
                  </p>
                )}
                {/* Module chips */}
                <div className="flex flex-wrap gap-1">
                  {MODULES.filter((m) => {
                    const p = role.permissions.find((x) => x.module === m);
                    return p?.can_view;
                  }).map((m) => {
                    const p = role.permissions.find((x) => x.module === m)!;
                    const parts = [];
                    if (p.can_view) parts.push("V");
                    if (p.can_create) parts.push("C");
                    if (p.can_edit) parts.push("E");
                    return (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-muted text-muted-foreground"
                      >
                        {MODULE_LABELS[m]}
                        <span className="text-[9px] opacity-60">
                          {parts.join("/")}
                        </span>
                      </span>
                    );
                  })}
                  {moduleCount === 0 && (
                    <span className="text-xs text-muted-foreground italic">
                      No module access
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialogRole(role)}
                  className="gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                {!role.is_system && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Delete role "${role.name}"?`))
                        deleteRole(role.id);
                    }}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog */}
      {dialogRole !== null && (
        <RoleDialog
          open
          onClose={() => setDialogRole(null)}
          existing={dialogRole === "new" ? undefined : dialogRole}
        />
      )}
    </div>
  );
}
