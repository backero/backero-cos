"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  GripVertical,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { formatDistanceToNow, isPast, format } from "date-fns";
import { Button } from "@/components/ui/button";
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
  useAddComment,
  useCreateTask,
  useDeleteTask,
  useEmployees,
  useUpdateTask,
  useUpdateTaskStatus,
  useTasks,
} from "@/hooks/use-queries";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";
import { useAuthStore } from "@/stores/auth-store";

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; label: string; topColor: string; icon: React.ReactNode }[] = [
  { id: "todo", label: "To Do", topColor: "border-t-slate-400", icon: <Clock className="w-4 h-4 text-slate-400" /> },
  { id: "in_progress", label: "In Progress", topColor: "border-t-blue-500", icon: <Loader2 className="w-4 h-4 text-blue-500" /> },
  { id: "review", label: "Review", topColor: "border-t-amber-500", icon: <AlertCircle className="w-4 h-4 text-amber-500" /> },
  { id: "done", label: "Done", topColor: "border-t-emerald-500", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", dot: "bg-blue-500" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-500" },
  critical: { label: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
};

const taskSchema = z.object({
  title: z.string().min(3, "At least 3 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  due_date: z.string().optional(),
  assigned_to_id: z.string().optional(),
});
type TaskForm = z.infer<typeof taskSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeStatus(status: string): TaskStatus {
  if (status === "pending") return "todo";
  if (status === "completed") return "done";
  if (status === "overdue") return "todo";
  return status as TaskStatus;
}

function isOverdue(task: Task) {
  return task.due_date && isPast(new Date(task.due_date)) && task.status !== "done";
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = "sm" }: { name?: string | null; url?: string | null; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";
  if (url) return <img src={url} alt={name ?? ""} className={cn(sz, "rounded-full object-cover flex-shrink-0")} />;
  const initials = name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  return (
    <div className={cn(sz, "rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0")}>
      {initials}
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onOpen, isDraggingOverlay = false }: { task: Task; onOpen: (t: Task) => void; isDraggingOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  const overdue = isOverdue(task);
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={cn(
          "bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm",
          "hover:shadow-md transition-all cursor-pointer",
          isDraggingOverlay && "shadow-2xl ring-2 ring-primary/30 rotate-1",
          overdue && "border-l-4 border-l-red-500",
        )}
        onClick={() => onOpen(task)}
      >
        <div {...listeners} onClick={(e) => e.stopPropagation()} className="px-3 pt-2.5 pb-0 flex items-center justify-between">
          <GripVertical className="w-3.5 h-3.5 text-slate-300 cursor-grab active:cursor-grabbing" />
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", pri.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", pri.dot)} />
            {pri.label}
          </span>
        </div>
        <div className="px-3 pt-1.5 pb-3 space-y-2">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{task.title}</p>
          {task.due_date && (
            <div className={cn("flex items-center gap-1 text-xs", overdue ? "text-red-500 font-medium" : "text-slate-400")}>
              <Calendar className="w-3 h-3" />
              {overdue && "Overdue · "}
              {format(new Date(task.due_date), "MMM d")}
            </div>
          )}
          <div className="flex items-center justify-between pt-0.5">
            {task.assigned_to ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={task.assigned_to.name} url={task.assigned_to.avatar_url} />
                <span className="text-xs text-slate-500 truncate max-w-[80px]">{task.assigned_to.name.split(" ")[0]}</span>
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                <User className="w-3 h-3 text-slate-300" />
              </div>
            )}
            {(task.comments_count ?? task.comments?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <MessageSquare className="w-3 h-3" /> {task.comments_count ?? task.comments?.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ column, tasks, onOpen }: { column: typeof COLUMNS[number]; tasks: Task[]; onOpen: (t: Task) => void }) {
  const ids = useMemo(() => tasks.map((t) => t.id), [tasks]);
  // Register the column itself as a droppable so dragging onto an empty column works
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      <div className={cn("flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 border-t-4 shadow-sm", column.topColor)}>
        <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {column.icon}
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{column.label}</span>
          </div>
          <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {tasks.length}
          </span>
        </div>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={cn("flex-1 overflow-y-auto p-3 space-y-2 rounded-b-xl transition-colors", isOver && "bg-primary/5")}
          >
            <AnimatePresence>
              {tasks.map((task) => (
                <motion.div key={task.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <TaskCard task={task} onOpen={onOpen} />
                </motion.div>
              ))}
            </AnimatePresence>
            {tasks.length === 0 && (
              <div className={cn("flex items-center justify-center h-full min-h-[80px] text-xs border-2 border-dashed rounded-lg transition-colors",
                isOver ? "border-primary/40 text-primary/60" : "border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600")}>
                Drop here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

const editSchema = z.object({
  title: z.string().min(3, "At least 3 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  due_date: z.string().optional(),
  assigned_to_id: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

// ── Task Detail Sheet ─────────────────────────────────────────────────────────
function TaskDetailSheet({
  task,
  open,
  onClose,
  employees,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  employees: { id: string; name: string }[];
}) {
  const [comment, setComment] = useState("");
  const addComment = useAddComment();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { user } = useAuthStore();

  const canEdit = user?.role !== "employee" || task?.assigned_to_id === user?.id;
  const canDelete = task?.created_by_id === user?.id || user?.role === "super_admin" || (user?.permissions?.tasks?.can_edit ?? false);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: task
      ? {
          title: task.title,
          description: task.description ?? "",
          priority: (task.priority as EditForm["priority"]) ?? "medium",
          status: normalizeStatus(task.status) as EditForm["status"],
          due_date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "",
          assigned_to_id: task.assigned_to_id ?? "none",
        }
      : undefined,
  });

  async function onSave(data: EditForm) {
    if (!task) return;
    await updateTask.mutateAsync({
      id: task.id,
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
        assigned_to_id: !data.assigned_to_id || data.assigned_to_id === "none" ? null : data.assigned_to_id,
      },
    });
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    addComment.mutate({ taskId: task!.id, content: comment.trim() });
    setComment("");
  }

  function handleDelete() {
    if (!confirm("Delete this task?")) return;
    deleteTask.mutate(task!.id, { onSuccess: onClose });
  }

  if (!task) return null;
  const overdue = isOverdue(task);
  const pri = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", pri.color)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", pri.dot)} />
              {pri.label}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                <AlertCircle className="w-3 h-3" /> Overdue
              </span>
            )}
          </div>
          <SheetTitle className="text-base font-semibold leading-snug">{task.title}</SheetTitle>
          <SheetDescription className="sr-only">Edit task</SheetDescription>
        </SheetHeader>

        <form id="edit-task-form" onSubmit={form.handleSubmit(onSave)}>
          <SheetBody className="space-y-4">

            {/* Edit fields — only visible to those who can edit */}
            {canEdit ? (
              <>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input {...form.register("title")} />
                  {form.formState.errors.title && (
                    <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={3} {...form.register("description")} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(v) => form.setValue("status", v as EditForm["status"], { shouldDirty: true })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={form.watch("priority")}
                      onValueChange={(v) => form.setValue("priority", v as EditForm["priority"], { shouldDirty: true })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Due Date</Label>
                    <Input type="date" {...form.register("due_date")} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Assignee</Label>
                    <Select
                      value={form.watch("assigned_to_id") ?? "none"}
                      onValueChange={(v) => form.setValue("assigned_to_id", v, { shouldDirty: true })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              /* Read-only view for non-editors */
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Status</p>
                  <p className="font-medium capitalize">{task.status.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Due Date</p>
                  <p className={cn("font-medium", overdue ? "text-red-500" : "")}>
                    {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "—"}
                  </p>
                </div>
              </div>
            )}

            {/* Reporter (always read-only) */}
            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Reporter</p>
                {task.created_by ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={task.created_by.name} url={task.created_by.avatar_url} size="sm" />
                    <span className="text-sm font-medium truncate">{task.created_by.name}</span>
                  </div>
                ) : <span className="text-slate-400 text-xs">—</span>}
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Created</p>
                <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</p>
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Comments ({task.comments?.length ?? 0})
              </p>
              <div className="space-y-3">
                {(task.comments ?? []).map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar name={c.author?.name} url={c.author?.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 rounded-xl rounded-tl-none px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.author?.name ?? "User"}</span>
                        <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleComment} className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="sm" disabled={!comment.trim() || addComment.isPending} className="h-9 px-3">
                  {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </form>
            </div>

          </SheetBody>
        </form>

        <SheetFooter>
          {canDelete && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
              className="gap-1.5 mr-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          )}
          {canEdit && (
            <Button
              type="submit"
              form="edit-task-form"
              disabled={updateTask.isPending || !form.formState.isDirty}
            >
              {updateTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Create Task Sheet ─────────────────────────────────────────────────────────
function CreateTaskSheet({ open, onClose, employees }: { open: boolean; onClose: () => void; employees: { id: string; name: string }[] }) {
  const createTask = useCreateTask();
  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium" },
  });

  async function onSubmit(data: TaskForm) {
    await createTask.mutateAsync({
      ...data,
      due_date: data.due_date ? new Date(data.due_date).toISOString() : undefined,
      assigned_to_id: !data.assigned_to_id || data.assigned_to_id === "none" ? undefined : data.assigned_to_id,
    });
    form.reset();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New Task</SheetTitle>
          <SheetDescription>Add a task to the board</SheetDescription>
        </SheetHeader>

        {/* form id lets the submit button live in SheetFooter outside the form */}
        <form id="create-task-form" onSubmit={form.handleSubmit(onSubmit)}>
          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="Task title" {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Add context…" rows={3} {...form.register("description")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select defaultValue="medium" onValueChange={(v) => form.setValue("priority", v as TaskForm["priority"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" {...form.register("due_date")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select onValueChange={(v) => form.setValue("assigned_to_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </SheetBody>
        </form>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-task-form" disabled={createTask.isPending}>
            {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Task
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuthStore();
  const canCreate = user?.permissions?.tasks?.can_create ?? true;

  const { data: employees = [] } = useEmployees({ is_active: true });
  const { data: tasks = [], isLoading } = useTasks({
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    assigned_to_id: assigneeFilter !== "all" ? assigneeFilter : undefined,
    search: debouncedSearch || undefined,
  });

  const updateStatus = useUpdateTaskStatus();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(setTimeout(() => setDebouncedSearch(e.target.value), 300));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;

    // over.id is either a column id (useDroppable) or a task id (useSortable)
    let targetColId: TaskStatus | undefined;
    if (COLUMNS.some((c) => c.id === over.id)) {
      targetColId = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetColId = normalizeStatus(overTask.status);
    }

    if (!targetColId) return;
    if (normalizeStatus(dragged.status) === targetColId) return;
    updateStatus.mutate({ id: dragged.id, status: targetColId });
  }

  const columnTasks = useMemo(() => {
    const map: Record<string, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
    for (const task of tasks) {
      const s = normalizeStatus(task.status);
      (map[s] ?? map.todo).push(task);
    }
    return map;
  }, [tasks]);

  const totalTasks = tasks.length;
  const doneTasks = columnTasks.done?.length ?? 0;
  const overdueTasks = tasks.filter(isOverdue).length;
  const hasFilters = !!(priorityFilter !== "all" || assigneeFilter !== "all" || debouncedSearch);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Task Board</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {doneTasks}/{totalTasks} done
              {overdueTasks > 0 && <span className="ml-2 text-red-500 font-medium">· {overdueTasks} overdue</span>}
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> New Task
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input value={search} onChange={handleSearchChange} placeholder="Search tasks…" className="pl-8 h-8 text-sm" />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 text-xs w-32">
              <Filter className="w-3 h-3 mr-1 text-slate-400" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 text-xs w-36">
              <User className="w-3 h-3 mr-1 text-slate-400" />
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
              onClick={() => { setPriorityFilter("all"); setAssigneeFilter("all"); setSearch(""); setDebouncedSearch(""); }}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-auto p-6 min-h-0">
        {isLoading ? (
          <div className="flex gap-4 h-full">
            {COLUMNS.map((c) => (
              <div key={c.id} className="flex-1 min-w-0 space-y-3">
                <Skeleton className="h-12 rounded-xl" />
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 h-full">
              {COLUMNS.map((col) => (
                <KanbanColumn key={col.id} column={col} tasks={columnTasks[col.id] ?? []} onOpen={setSelectedTask} />
              ))}
            </div>
            <DragOverlay>
              {activeTask && <TaskCard task={activeTask} onOpen={() => {}} isDraggingOverlay />}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <CreateTaskSheet open={createOpen} onClose={() => setCreateOpen(false)} employees={employees} />
      <TaskDetailSheet
        task={selectedTask ? (tasks.find((t) => t.id === selectedTask.id) ?? selectedTask) : null}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        employees={employees}
      />
    </div>
  );
}
