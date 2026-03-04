"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useTasks,
} from "@/hooks/use-queries";
import { cn, formatDate, getPriorityColor, getStatusColor } from "@/lib/utils";
import type { Task } from "@/types";
import { useUIStore } from "@/stores/ui-store";

const taskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string().optional(),
  assigned_to_id: z.string().optional(),
});

type TaskForm = z.infer<typeof taskSchema>;

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;
const STATUS_OPTIONS = [
  "",
  "pending",
  "in_progress",
  "completed",
  "overdue",
] as const;

export default function TasksPage() {
  const { modals, openModal, closeModal } = useUIStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const { data: tasks, isLoading } = useTasks({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  });

  const createTask = useCreateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium" },
  });

  async function onSubmit(data: TaskForm) {
    await createTask.mutateAsync({
      ...data,
      due_date: data.due_date
        ? new Date(data.due_date).toISOString()
        : undefined,
    });
    form.reset();
    closeModal("createTask");
  }

  const grouped = {
    overdue: tasks?.filter((t) => t.status === "overdue") ?? [],
    in_progress: tasks?.filter((t) => t.status === "in_progress") ?? [],
    pending: tasks?.filter((t) => t.status === "pending") ?? [],
    completed: tasks?.filter((t) => t.status === "completed") ?? [],
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">All Tasks</h2>
          <p className="text-muted-foreground text-sm">
            {tasks?.length ?? 0} tasks total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.slice(1).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter || "all"}
            onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => openModal("createTask")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Task
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {grouped.overdue.length > 0 && (
            <TaskGroup
              label="Overdue"
              tasks={grouped.overdue}
              color="text-red-600 dark:text-red-400"
              onComplete={(id) => completeTask.mutate(id)}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          )}
          {/* In Progress */}
          {grouped.in_progress.length > 0 && (
            <TaskGroup
              label="In Progress"
              tasks={grouped.in_progress}
              color="text-blue-600 dark:text-blue-400"
              onComplete={(id) => completeTask.mutate(id)}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          )}
          {/* Pending */}
          {grouped.pending.length > 0 && (
            <TaskGroup
              label="Pending"
              tasks={grouped.pending}
              color="text-yellow-600 dark:text-yellow-400"
              onComplete={(id) => completeTask.mutate(id)}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          )}
          {/* Completed */}
          {grouped.completed.length > 0 && (
            <TaskGroup
              label="Completed"
              tasks={grouped.completed}
              color="text-green-600 dark:text-green-400"
              onComplete={(id) => completeTask.mutate(id)}
              onDelete={(id) => deleteTask.mutate(id)}
            />
          )}
          {(tasks?.length ?? 0) === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No tasks found</p>
            </div>
          )}
        </div>
      )}

      {/* Create Task Dialog */}
      <Dialog
        open={modals["createTask"]}
        onOpenChange={(o) => !o && closeModal("createTask")}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input {...form.register("title")} placeholder="Task title..." />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                {...form.register("description")}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  defaultValue="medium"
                  onValueChange={(v) =>
                    form.setValue("priority", v as TaskForm["priority"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="datetime-local" {...form.register("due_date")} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeModal("createTask")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending && (
                  <Loader2 className="w-3 h-3 animate-spin mr-2" />
                )}
                Create Task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskGroup({
  label,
  tasks,
  color,
  onComplete,
  onDelete,
}: {
  label: string;
  tasks: Task[];
  color: string;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3
        className={cn(
          "text-sm font-semibold mb-2 flex items-center gap-2",
          color,
        )}
      >
        {label}
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-normal">
          {tasks.length}
        </span>
      </h3>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      task.status !== "completed" && onComplete(task.id)
                    }
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      task.status === "completed"
                        ? "border-green-500 bg-green-500"
                        : "border-muted-foreground/30 hover:border-primary",
                    )}
                  >
                    {task.status === "completed" && (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        task.status === "completed" &&
                          "line-through text-muted-foreground",
                      )}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          getPriorityColor(task.priority),
                        )}
                      >
                        {task.priority}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          getStatusColor(task.status),
                        )}
                      >
                        {task.status.replace("_", " ")}
                      </Badge>
                      {task.due_date && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onDelete(task.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
