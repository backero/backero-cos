"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Calendar,
  LayoutGrid,
  LayoutList,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAttendance,
  useCheckIn,
  useCheckOut,
  useCreateDepartment,
  useCreateEmployee,
  useUpdateEmployee,
  useDepartments,
  useEmployees,
  useExportEmployees,
  useImportEmployees,
  useRoles,
} from "@/hooks/use-queries";
import { ImportExportMenu } from "@/components/ImportExportMenu";
import { api } from "@/lib/api-client";
import { format, getDaysInMonth, startOfMonth } from "date-fns";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { bindApiError } from "@/lib/api-client";
import type { Department, Employee } from "@/types";

// ── Schemas ───────────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().regex(/^\d{10}$/, "10-digit mobile required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  role_id: z.string().min(1, "Role is required"),
  designation: z.string().optional(),
  department_id: z.string().optional(),
  salary: z.number().positive().optional(),
  join_date: z.string().optional(),
});

const departmentSchema = z.object({
  name: z.string().min(2, "Department name required"),
  description: z.string().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;
type DepartmentForm = z.infer<typeof departmentSchema>;

type ViewMode = "card" | "table";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeesPage() { 
  const { modals, openModal, closeModal } = useUIStore();
  const { canCreate, canEdit } = useAuthStore();
  const [deptFilter, setDeptFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deptDialog, setDeptDialog] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active");
  const { user } = useAuthStore();

  const canCreateEmp = canCreate("employees");
  const canEditEmp   = canEdit("employees");
  const canCreateDept = canCreate("employees");

  const { data: employees, isLoading } = useEmployees({
    department_id: deptFilter || undefined,
    is_active: activeFilter === "active",
  });
  const { data: departments } = useDepartments();
  const { data: roles = [] } = useRoles();

  const createEmployee = useCreateEmployee();
  const exportEmployees = useExportEmployees();
  const importEmployees = useImportEmployees();

  // Employee create form
  const empForm = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
  });

  const filtered = employees?.filter((e) =>
    search
      ? e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.phone.includes(search) ||
        e.email?.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  async function onSubmitEmployee(data: EmployeeForm) {
    try {
      await createEmployee.mutateAsync({
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        role_id: data.role_id,
        designation: data.designation || undefined,
        department_id: data.department_id || undefined,
        salary: data.salary ?? undefined,
        join_date: data.join_date || undefined,
      } as Record<string, unknown>);
      empForm.reset();
      closeModal("createEmployee");
    } catch (err) {
      bindApiError(err, empForm.setError as Parameters<typeof bindApiError>[1]);
    }
  }

  const checkIn  = useCheckIn();
  const checkOut = useCheckOut();

  return (
    <div className="space-y-6 w-full flex-1">
      <Tabs defaultValue="employees">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="w-4 h-4" /> Employees
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <Building2 className="w-4 h-4" /> Departments
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 flex-wrap">
            <TabsContent value="employees" className="m-0 flex gap-2">
              <ImportExportMenu
                onExport={() => exportEmployees.mutateAsync()}
                onImport={(f) => importEmployees.mutateAsync(f)}
                onSampleDownload={() => api.employees.sample()}
                exportLabel="Export Employees"
                importLabel="Import Employees"
                isExporting={exportEmployees.isPending}
                isImporting={importEmployees.isPending}
              />
              {canCreateEmp && (
                <Button size="sm" onClick={() => openModal("createEmployee")}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Employee
                </Button>
              )}
            </TabsContent>
            <TabsContent value="departments" className="m-0">
              {canCreateDept && (
                <Button size="sm" onClick={() => setDeptDialog(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> New Department
                </Button>
              )}
            </TabsContent>
          </div>
        </div>

        {/* ── Employees Tab ── */}
        <TabsContent value="employees" className="mt-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: activeFilter === "active" ? "Total Active" : "Total Inactive", value: employees?.length ?? 0, icon: activeFilter === "active" ? Users : UserX, color: activeFilter === "active" ? "bg-blue-500" : "bg-slate-400" },
              { label: "Present Today", value: "—",                    icon: UserCheck,  color: "bg-green-500" },
              { label: "Departments",   value: departments?.length ?? 0, icon: Building2, color: "bg-purple-500" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", stat.color)}>
                      <stat.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Filters + View toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Active / Inactive toggle */}
            <div className="flex items-center rounded-md border border-border overflow-hidden text-sm">
              <button
                onClick={() => setActiveFilter("active")}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-9 transition-colors",
                  activeFilter === "active"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Users className="w-3.5 h-3.5" /> Active
              </button>
              <button
                onClick={() => setActiveFilter("inactive")}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-9 transition-colors",
                  activeFilter === "inactive"
                    ? "bg-slate-500 text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <UserX className="w-3.5 h-3.5" /> Inactive
              </button>
            </div>

            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search by name, phone or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={deptFilter || "all"}
              onValueChange={(v) => setDeptFilter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View mode toggle */}
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("card")}
                className={cn(
                  "flex items-center justify-center w-9 h-9 transition-colors",
                  viewMode === "card"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center justify-center w-9 h-9 transition-colors",
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                title="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            viewMode === "card" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-52 rounded-xl" />
                ))}
              </div>
            ) : (
              <Skeleton className="h-64 rounded-xl" />
            )
          ) : (filtered?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No employees found</p>
              </CardContent>
            </Card>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered?.map((employee, i) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  index={i}
                  isCurrentUser={employee.id === user?.id}
                  canCheckIn={employee.id === user?.id || canEditEmp}
                  canEdit={canEditEmp}
                  roles={roles}
                  onEdit={() => setEditEmployee(employee)}
                  onCheckIn={() => checkIn.mutate({ id: employee.id })}
                  onCheckOut={() => checkOut.mutate(employee.id)}
                  checkInLoading={checkIn.isPending}
                  checkOutLoading={checkOut.isPending}
                />
              ))}
            </div>
          ) : (
            <EmployeeTable
              employees={filtered ?? []}
              currentUserId={user?.id}
              canEdit={canEditEmp}
              roles={roles}
              onEdit={(emp) => setEditEmployee(emp)}
              onCheckIn={(id) => checkIn.mutate({ id })}
              onCheckOut={(id) => checkOut.mutate(id)}
              checkInLoading={checkIn.isPending}
              checkOutLoading={checkOut.isPending}
            />
          )}
        </TabsContent>

        {/* ── Departments Tab ── */}
        <TabsContent value="departments" className="mt-6">
          <DepartmentsTab departments={departments ?? []} canEdit={canEditEmp} />
        </TabsContent>
      </Tabs>

      {/* ── Create Employee Sheet ── */}
      <Sheet
        open={modals["createEmployee"]}
        onOpenChange={(o) => !o && closeModal("createEmployee")}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add New Employee</SheetTitle>
            <SheetDescription>Fill in the employee details and assign a role.</SheetDescription>
          </SheetHeader>
          <form onSubmit={empForm.handleSubmit(onSubmitEmployee)} className="flex flex-col flex-1 overflow-hidden">
            <SheetBody className="space-y-4">
              <EmployeeFormFields
                form={empForm}
                roles={roles}
                departments={departments ?? []}
              />
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => closeModal("createEmployee")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createEmployee.isPending}>
                {createEmployee.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Add Employee
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Edit Employee Sheet ── */}
      {editEmployee && (
        <EditEmployeeSheet
          employee={editEmployee}
          roles={roles}
          departments={departments ?? []}
          onClose={() => setEditEmployee(null)}
        />
      )}

      {/* ── Create Department Sheet ── */}
      <CreateDepartmentDialog open={deptDialog} onClose={() => setDeptDialog(false)} />
    </div>
  );
}

// ── Shared form fields ─────────────────────────────────────────────────────────

function EmployeeFormFields({
  form,
  roles,
  departments,
}: {
  form: ReturnType<typeof useForm<EmployeeForm>>;
  roles: { id: string; name: string; color: string }[];
  departments: Department[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Name */}
      <div className="space-y-1.5 col-span-2">
        <Label>Full Name *</Label>
        <Input {...form.register("name")} placeholder="e.g. Priya Sharma" />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label>Mobile Number *</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            {...form.register("phone")}
            type="tel"
            maxLength={10}
            placeholder="10-digit number"
            className="pl-9"
          />
        </div>
        {form.formState.errors.phone && (
          <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label>Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            {...form.register("email")}
            type="email"
            placeholder="Optional"
            className="pl-9"
          />
        </div>
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <Label>Role *</Label>
        <Select
          value={form.watch("role_id") || ""}
          onValueChange={(v) => form.setValue("role_id", v, { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a role…" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  {r.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.role_id && (
          <p className="text-xs text-destructive">{form.formState.errors.role_id.message}</p>
        )}
      </div>

      {/* Department */}
      <div className="space-y-1.5">
        <Label>Department</Label>
        <Select
          value={form.watch("department_id") || "none"}
          onValueChange={(v) => form.setValue("department_id", v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select dept." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Designation */}
      <div className="space-y-1.5">
        <Label>Designation</Label>
        <Input {...form.register("designation")} placeholder="e.g. Sales Executive" />
      </div>

      {/* Salary */}
      <div className="space-y-1.5">
        <Label>Monthly Salary (₹)</Label>
        <Input
          type="number"
          {...form.register("salary", { valueAsNumber: true })}
          placeholder="Optional"
        />
      </div>

      {/* Join Date */}
      <div className="space-y-1.5 col-span-2">
        <Label>Join Date</Label>
        <Input type="date" {...form.register("join_date")} />
      </div>
    </div>
  );
}

// ── Edit Employee Sheet ────────────────────────────────────────────────────────

function EditEmployeeSheet({
  employee,
  roles,
  departments,
  onClose,
}: {
  employee: Employee;
  roles: { id: string; name: string; color: string }[];
  departments: Department[];
  onClose: () => void;
}) {
  const updateEmployee = useUpdateEmployee();

  const form = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: employee.name,
      phone: employee.phone,
      email: employee.email ?? "",
      role_id: employee.role_id ?? "",
      designation: employee.designation ?? "",
      department_id: employee.department_id ?? "",
      salary: employee.salary ?? undefined,
      join_date: employee.join_date ?? "",
    },
  });

  async function onSubmit(data: EmployeeForm) {
    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          role_id: data.role_id,
          designation: data.designation || null,
          department_id: data.department_id || null,
          salary: data.salary ?? null,
          join_date: data.join_date || null,
        },
      });
      onClose();
    } catch (err) {
      bindApiError(err, form.setError as Parameters<typeof bindApiError>[1]);
    }
  }

  async function toggleActive() {
    await updateEmployee.mutateAsync({
      id: employee.id,
      data: { is_active: !employee.is_active },
    });
    onClose();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Employee</SheetTitle>
          <SheetDescription>Update details for {employee.name}.</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <SheetBody className="space-y-4">
            <EmployeeFormFields form={form} roles={roles} departments={departments} />
          </SheetBody>
          <SheetFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex gap-2 w-full">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={updateEmployee.isPending} className="flex-1">
                {updateEmployee.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full gap-2",
                employee.is_active
                  ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                  : "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400",
              )}
              onClick={toggleActive}
              disabled={updateEmployee.isPending}
            >
              {employee.is_active ? (
                <><UserX className="w-4 h-4" /> Deactivate Employee</>
              ) : (
                <><UserCheck className="w-4 h-4" /> Activate Employee</>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Employee Table View ────────────────────────────────────────────────────────

function EmployeeTable({
  employees,
  currentUserId,
  canEdit,
  roles,
  onEdit,
  onCheckIn,
  onCheckOut,
  checkInLoading,
  checkOutLoading,
}: {
  employees: Employee[];
  currentUserId?: string;
  canEdit: boolean;
  roles: { id: string; name: string; color: string }[];
  onEdit: (emp: Employee) => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  checkInLoading: boolean;
  checkOutLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Role</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Department</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Salary</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Joined</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const roleColor = roles.find((r) => r.name === emp.role)?.color ?? "#64748b";
            const isCurrentUser = emp.id === currentUserId;
            const canCheckInEmp = isCurrentUser || canEdit;

            return (
              <tr
                key={emp.id}
                className={cn(
                  "border-b border-border last:border-0 transition-colors hover:bg-muted/30",
                  i % 2 === 0 ? "bg-background" : "bg-muted/10",
                )}
              >
                {/* Name + avatar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className={cn("w-8 h-8 shrink-0", !emp.is_active && "opacity-50")}>
                      <AvatarImage
                        src={emp.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=4d8731&color=fff&size=32`}
                        alt={emp.name}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(emp.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-medium truncate", emp.is_active ? "text-foreground" : "text-muted-foreground")}>{emp.name}</span>
                        {isCurrentUser && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0 shrink-0">You</Badge>
                        )}
                        {!emp.is_active && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border-0 shrink-0">Inactive</Badge>
                        )}
                      </div>
                      {emp.designation && (
                        <p className="text-xs text-muted-foreground truncate">{emp.designation}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                    style={{ backgroundColor: roleColor }}
                  >
                    {emp.role}
                  </span>
                </td>

                {/* Department */}
                <td className="px-4 py-3 hidden md:table-cell">
                  {emp.department_name ? (
                    <Badge variant="secondary" className="text-[11px]">{emp.department_name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>

                {/* Phone */}
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                  {emp.phone}
                </td>

                {/* Salary */}
                <td className="px-4 py-3 text-right hidden lg:table-cell">
                  {emp.salary != null ? (
                    <span className="font-medium">₹{emp.salary.toLocaleString("en-IN")}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* Join date */}
                <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                  {emp.join_date ? formatDate(emp.join_date) : "—"}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {canCheckInEmp && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
                          onClick={() => onCheckIn(emp.id)}
                          disabled={checkInLoading}
                          title="Check In"
                        >
                          {checkInLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                          <span className="hidden sm:inline ml-1">In</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                          onClick={() => onCheckOut(emp.id)}
                          disabled={checkOutLoading}
                          title="Check Out"
                        >
                          {checkOutLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                          <span className="hidden sm:inline ml-1">Out</span>
                        </Button>
                      </>
                    )}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 gap-1 text-xs"
                        onClick={() => onEdit(emp)}
                      >
                        <Pencil className="w-3 h-3" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Departments Tab ───────────────────────────────────────────────────────────

function DepartmentsTab({
  departments,
  canEdit,
}: {
  departments: Department[];
  canEdit: boolean;
}) {
  const [editDept, setEditDept] = useState<Department | null>(null);

  if (departments.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-4">No departments yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((dept, i) => (
        <motion.div
          key={dept.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{dept.name}</p>
                {dept.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{dept.description}</p>
                )}
              </div>
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 shrink-0 text-muted-foreground"
                  onClick={() => setEditDept(dept)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {editDept && (
        <CreateDepartmentDialog
          open
          onClose={() => setEditDept(null)}
          existing={editDept}
        />
      )}
    </div>
  );
}

// ── Create/Edit Department Sheet ───────────────────────────────────────────────

function CreateDepartmentDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Department;
}) {
  const createDept = useCreateDepartment();

  const form = useForm<DepartmentForm>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: existing?.name ?? "",
      description: existing?.description ?? "",
    },
  });

  async function onSubmit(data: DepartmentForm) {
    try {
      await createDept.mutateAsync({ name: data.name, description: data.description || undefined });
      form.reset();
      onClose();
    } catch (err) {
      bindApiError(err, form.setError as Parameters<typeof bindApiError>[1]);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-[400px]">
        <SheetHeader>
          <SheetTitle>{existing ? "Edit Department" : "New Department"}</SheetTitle>
          <SheetDescription>
            {existing ? "Update the department details." : "Create a new department to organise your team."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Department Name *</Label>
              <Input {...form.register("name")} placeholder="e.g. Marketing" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input {...form.register("description")} placeholder="Brief description (optional)" />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createDept.isPending}>
              {createDept.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
              {existing ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Employee Card ─────────────────────────────────────────────────────────────

// ── Attendance Mini Calendar ──────────────────────────────────────────────────

const ATT_STATUS_COLOR: Record<string, string> = {
  present: "bg-green-500",
  absent: "bg-red-400",
  half_day: "bg-yellow-400",
  wfh: "bg-blue-400",
};

function AttendanceCalendar({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const { data: records = [], isLoading } = useAttendance(employeeId, calMonth, calYear);

  const daysInMonth = getDaysInMonth(new Date(calYear, calMonth - 1));
  const firstDay = startOfMonth(new Date(calYear, calMonth - 1)).getDay();

  const byDate: Record<string, string> = {};
  records.forEach((r) => {
    const d = typeof r.date === "string" ? r.date : format(new Date(r.date), "yyyy-MM-dd");
    byDate[d] = r.status;
  });

  function prevMonth() {
    if (calMonth === 1) { setCalMonth(12); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalMonth(1); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="text-slate-400 hover:text-slate-600 text-xs px-1">‹</button>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          {format(new Date(calYear, calMonth - 1), "MMM yyyy")}
        </span>
        <button onClick={nextMonth} className="text-slate-400 hover:text-slate-600 text-xs px-1">›</button>
      </div>
      {isLoading ? (
        <div className="h-16 flex items-center justify-center text-xs text-slate-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} className="text-[9px] text-center text-slate-400 font-medium">{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateKey = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const status = byDate[dateKey];
            const isToday = dateKey === format(now, "yyyy-MM-dd");
            return (
              <div key={day} className="flex items-center justify-center" title={status ?? ""}>
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium",
                  isToday && !status ? "ring-1 ring-primary text-primary" : "",
                  status ? `${ATT_STATUS_COLOR[status]} text-white` : "text-slate-500",
                )}>
                  {day}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2 mt-2 flex-wrap">
        {Object.entries(ATT_STATUS_COLOR).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", c)} />
            <span className="text-[9px] capitalize text-slate-400">{s.replace("_"," ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeCard({
  employee,
  index,
  isCurrentUser,
  canCheckIn,
  canEdit,
  roles,
  onEdit,
  onCheckIn,
  onCheckOut,
  checkInLoading,
  checkOutLoading,
}: {
  employee: Employee;
  index: number;
  isCurrentUser: boolean;
  canCheckIn: boolean;
  canEdit: boolean;
  roles: { id: string; name: string; color: string }[];
  onEdit: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  checkInLoading: boolean;
  checkOutLoading: boolean;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const roleColor = roles.find((r) => r.name === employee.role)?.color ?? "#64748b";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      whileHover={{ y: -2 }}
    >
      <Card className={cn("overflow-hidden hover:shadow-md transition-shadow", isCurrentUser && "border-primary/30", !employee.is_active && "opacity-60")}>
        <CardContent className="p-5">
          {/* Avatar + Name + Edit button */}
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="w-12 h-12 shrink-0">
              <AvatarImage
                src={
                  employee.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name)}&background=4d8731&color=fff&size=48`
                }
                alt={employee.name}
              />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {getInitials(employee.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">{employee.name}</p>
                {isCurrentUser && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">You</Badge>
                )}
                {!employee.is_active && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border-0">Inactive</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{employee.designation ?? "—"}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                  style={{ backgroundColor: roleColor }}
                >
                  {employee.role}
                </span>
                {employee.department_name && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {employee.department_name}
                  </Badge>
                )}
              </div>
            </div>
            {/* Edit button */}
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="w-7 h-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onEdit}
                title="Edit employee"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Details */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{employee.phone}</span>
            </div>
            {employee.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </div>
            )}
            {employee.join_date && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Joined {formatDate(employee.join_date)}</span>
              </div>
            )}
          </div>

          {/* Check-in / Check-out */}
          {canCheckIn && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
                onClick={onCheckIn}
                disabled={checkInLoading}
              >
                {checkInLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3 mr-1" />}
                Check In
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                onClick={onCheckOut}
                disabled={checkOutLoading}
              >
                {checkOutLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3 mr-1" />}
                Check Out
              </Button>
            </div>
          )}

          {/* Attendance calendar toggle */}
          <button
            onClick={() => setShowCalendar((v) => !v)}
            className="w-full mt-2 text-[10px] text-slate-400 hover:text-primary flex items-center gap-1 justify-center transition-colors"
          >
            <Calendar className="w-3 h-3" />
            {showCalendar ? "Hide" : "View"} Attendance
          </button>
          {showCalendar && <AttendanceCalendar employeeId={String(employee.id)} />}
        </CardContent>
      </Card>
    </motion.div>
  );
}
