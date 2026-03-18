"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Phone,
  Plus,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useCheckIn,
  useCheckOut,
  useCreateEmployee,
  useDepartments,
  useEmployees,
} from "@/hooks/use-queries";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { Employee } from "@/types";

// ── Schema ────────────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().regex(/^\d{10}$/, "10-digit mobile required"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "employee"]),
  designation: z.string().optional(),
  department_id: z.string().optional(),
  salary: z.number().positive().optional(),
  join_date: z.string().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

// ── Role Colors ───────────────────────────────────────────────────────────────

function getRoleColor(role: string) {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "manager":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { modals, openModal, closeModal } = useUIStore();
  const { user } = useAuthStore();
  const [deptFilter, setDeptFilter] = useState("");
  const [search, setSearch] = useState("");

  // Queries
  const { data: employees, isLoading } = useEmployees({
    department_id: deptFilter || undefined,
    is_active: true,
  });
  const { data: departments } = useDepartments();

  // Mutations
  const createEmployee = useCreateEmployee();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  // Form
  const form = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { role: "employee" },
  });

  // Filtered employees
  const filtered = employees?.filter((e) =>
    search
      ? e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.phone.includes(search) ||
        e.email?.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  // Handlers
  async function onSubmit(data: EmployeeForm) {
    await createEmployee.mutateAsync({
      ...data,
      email: data.email || undefined,
      salary: data.salary ?? undefined,
      join_date: data.join_date || undefined,
      department_id: data.department_id || undefined,
    } as Record<string, unknown>);
    form.reset();
    closeModal("createEmployee");
  }

  const canManage = user?.role === "admin" || user?.role === "manager";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full flex-1">
      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Total Active",
            value: employees?.length ?? 0,
            icon: Users,
            color: "bg-blue-500",
          },
          {
            label: "Present Today",
            value: "—",
            icon: UserCheck,
            color: "bg-green-500",
          },
          {
            label: "Departments",
            value: departments?.length ?? 0,
            icon: Building2,
            color: "bg-purple-500",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    stat.color,
                  )}
                >
                  <stat.icon className="w-4.5 h-4.5 text-white" />
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

      {/* ── Controls ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search by name, phone or email..."
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
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && (
          <Button size="sm" onClick={() => openModal("createEmployee")}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Employee
          </Button>
        )}
      </div>

      {/* ── Employee Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (filtered?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No employees found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((employee, i) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              index={i}
              isCurrentUser={employee.id === user?.id}
              canCheckIn={employee.id === user?.id || canManage}
              onCheckIn={() => checkIn.mutate({ id: employee.id })}
              onCheckOut={() => checkOut.mutate(employee.id)}
              checkInLoading={checkIn.isPending}
              checkOutLoading={checkOut.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Create Employee Dialog ── */}
      <Dialog
        open={modals["createEmployee"]}
        onOpenChange={(o) => !o && closeModal("createEmployee")}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name *</Label>
                <Input
                  {...form.register("name")}
                  placeholder="e.g. Priya Sharma"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
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
                  <p className="text-xs text-destructive">
                    {form.formState.errors.phone.message}
                  </p>
                )}
              </div>
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
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select
                  defaultValue="employee"
                  onValueChange={(v) =>
                    form.setValue("role", v as EmployeeForm["role"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select
                  onValueChange={(v) => form.setValue("department_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dept." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Designation</Label>
                <Input
                  {...form.register("designation")}
                  placeholder="e.g. Sales Executive"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Salary (₹)</Label>
                <Input
                  type="number"
                  {...form.register("salary", { valueAsNumber: true })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Join Date</Label>
                <Input type="date" {...form.register("join_date")} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeModal("createEmployee")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createEmployee.isPending}>
                {createEmployee.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                )}
                Add Employee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Employee Card ─────────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  index,
  isCurrentUser,
  canCheckIn,
  onCheckIn,
  onCheckOut,
  checkInLoading,
  checkOutLoading,
}: {
  employee: Employee;
  index: number;
  isCurrentUser: boolean;
  canCheckIn: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  checkInLoading: boolean;
  checkOutLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      whileHover={{ y: -2 }}
    >
      <Card
        className={cn(
          "overflow-hidden hover:shadow-md transition-shadow",
          isCurrentUser && "border-primary/30",
        )}
      >
        <CardContent className="p-5">
          {/* Avatar + Name */}
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="w-12 h-12 shrink-0">
              <AvatarImage
                src={
                  employee.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.name)}&background=E8526A&color=fff&size=48`
                }
                alt={employee.name}
              />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {getInitials(employee.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">
                  {employee.name}
                </p>
                {isCurrentUser && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                    You
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {employee.designation ?? "—"}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 py-0 border-0 capitalize",
                    getRoleColor(employee.role),
                  )}
                >
                  {employee.role}
                </Badge>
                {employee.department_name && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {employee.department_name}
                  </Badge>
                )}
              </div>
            </div>
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
                {checkInLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <LogIn className="w-3 h-3 mr-1" />
                )}
                Check In
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                onClick={onCheckOut}
                disabled={checkOutLoading}
              >
                {checkOutLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <LogOut className="w-3 h-3 mr-1" />
                )}
                Check Out
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
