"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useAddTaskComment,
  useApproveTask,
  useCompleteTask,
  useComplianceTasks,
  useCreateTask,
  useDeleteTask,
  useDepartments,
  useEmployees,
  useMe,
  useRejectTask,
  useSubmitCompletion,
  useTaskAttachments,
  useTaskComments,
  useTasks,
  useUpdateTask,
  useUploadTaskAttachment,
} from "@/hooks/use-queries";
import { api } from "@/lib/api-client";
import { cn, formatDate, getPriorityColor, getStatusColor } from "@/lib/utils";
import type { ComplianceTask, Task, TaskAttachment } from "@/types";
import { useUIStore } from "@/stores/ui-store";

const taskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const selected = new Date(val);
      const now = new Date();
      now.setSeconds(0, 0);
      return selected >= now;
    },
    "Due date cannot be in the past"
  ),
  assigned_to_id: z.string().optional(),
  department_id: z.string().optional(),
});

type TaskForm = z.infer<typeof taskSchema>;

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;
const STATUS_OPTIONS = ["", "pending", "in_progress", "pending_approval", "completed", "overdue"] as const;

function downloadTasksCSV(tasks: Task[] | undefined) {
  if (!tasks) return;
  const headers = ["Title", "Status", "Priority", "Assigned To", "Department", "Due Date", "Created At"];
  const rows = tasks.map((t) => [
    `"${t.title.replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    t.assigned_to_name ?? "",
    t.department_name ?? "",
    t.due_date ? new Date(t.due_date).toLocaleDateString("en-IN") : "",
    new Date(t.created_at).toLocaleDateString("en-IN"),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const CATEGORY_COLORS: Record<string, string> = {
  gst: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  tds: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  roc: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export default function TasksPage() {
  const { modals, openModal, closeModal } = useUIStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [commentText, setCommentText] = useState("");

  const { data: me } = useMe();
  const isManager = !!(
    me?.role?.toLowerCase().includes("manager") ||
    me?.role?.toLowerCase().includes("admin")
  );

  const [taskPage, setTaskPage] = useState(1);

  const { data: tasksData, isLoading } = useTasks({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    page: taskPage,
    limit: 100,
  });
  const tasks = tasksData?.items;
  const { data: employeeData } = useEmployees({ limit: 200 });
  const { data: departments } = useDepartments();
  const { data: complianceTasks, isLoading: complianceLoading } = useComplianceTasks();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const submitCompletion = useSubmitCompletion();
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();
  const { data: taskComments } = useTaskComments(selectedTask?.id ?? null);
  const addComment = useAddTaskComment(selectedTask?.id ?? null);
  const { data: taskAttachments } = useTaskAttachments(selectedTask?.id ?? null);
  const uploadAttachment = useUploadTaskAttachment(selectedTask?.id ?? null);
  const attachFileRef = useRef<HTMLInputElement>(null);

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium" },
  });

  const editForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium" },
  });

  const watchedAssignedTo = form.watch("assigned_to_id");
  const watchedDepartment = form.watch("department_id");

  async function onSubmit(data: TaskForm) {
    try {
      const assignee = employeeData?.items?.find((e) => e.id === data.assigned_to_id);
      const department = departments?.find((d) => d.id === data.department_id);
      const noteParts = [];
      if (assignee) noteParts.push(`Assigned to ${assignee.name}`);
      if (department) noteParts.push(`Department: ${department.name}`);
      const description = data.description?.trim()
        ? `${data.description.trim()}\n\n${noteParts.join(" · ")}`
        : noteParts.length > 0
        ? noteParts.join(" · ")
        : undefined;

      await createTask.mutateAsync({
        ...data,
        description,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : undefined,
      });
      form.reset();
      closeModal("createTask");
    } catch {
      // error handled by mutation onError toast
    }
  }

  function openTask(task: Task) {
    setSelectedTask(task);
    setCompletionNote("");
    setRejectNote("");
    setShowRejectInput(false);
    setEditMode(false);
    setCommentText("");
  }

  function startEditTask(task: Task) {
    const dueLocalStr = task.due_date
      ? new Date(new Date(task.due_date).getTime() - new Date(task.due_date).getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
    editForm.reset({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      due_date: dueLocalStr,
      assigned_to_id: task.assigned_to_id ?? undefined,
      department_id: task.department_id ?? undefined,
    });
    setEditMode(true);
  }

  async function onEditSubmit(data: TaskForm) {
    if (!selectedTask) return;
    try {
      const updated = await updateTask.mutateAsync({
        id: selectedTask.id,
        data: {
          title: data.title,
          description: data.description || undefined,
          priority: data.priority,
          due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
          assigned_to_id: data.assigned_to_id || null,
        },
      });
      setSelectedTask(updated);
      setEditMode(false);
    } catch {
      // error handled by mutation onError toast
    }
  }

  async function handleSubmitCompletion() {
    if (!selectedTask) return;
    try {
      const updated = await submitCompletion.mutateAsync({ id: selectedTask.id, note: completionNote || undefined });
      setSelectedTask(updated);
    } catch {
      // error handled by mutation onError toast
    }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync(commentText.trim());
      setCommentText("");
    } catch {
      // error handled by mutation onError toast
    }
  }

  async function handleApprove() {
    if (!selectedTask) return;
    try {
      const updated = await approveTask.mutateAsync(selectedTask.id);
      setSelectedTask(updated);
    } catch {
      // error handled by mutation onError toast
    }
  }

  async function handleReject() {
    if (!selectedTask) return;
    try {
      const updated = await rejectTask.mutateAsync({ id: selectedTask.id, note: rejectNote || undefined });
      setSelectedTask(updated);
      setShowRejectInput(false);
      setRejectNote("");
    } catch {
      // error handled by mutation onError toast
    }
  }

  const grouped = {
    overdue: tasks?.filter((t) => t.status === "overdue") ?? [],
    in_progress: tasks?.filter((t) => t.status === "in_progress") ?? [],
    pending_approval: tasks?.filter((t) => t.status === "pending_approval") ?? [],
    pending: tasks?.filter((t) => t.status === "pending") ?? [],
    completed: tasks?.filter((t) => t.status === "completed") ?? [],
  };


  const isMyTask = selectedTask?.assigned_to_id === me?.id;
  const isCreator = selectedTask?.created_by_id === me?.id;
  const isAdminOrAbove = me?.role?.toLowerCase() === "admin" || me?.role?.toLowerCase() === "super admin";
  const canSubmit = isMyTask && selectedTask?.status !== "completed" && selectedTask?.status !== "pending_approval";
  const canApproveReject = (isCreator || isAdminOrAbove) && selectedTask?.status === "pending_approval";

  return (
    <div className="space-y-6 w-full flex-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-lg">Tasks</h2>
          <p className="text-muted-foreground text-sm">{tasksData?.total ?? 0} tasks total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.slice(1).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => downloadTasksCSV(tasks)} disabled={!tasks?.length}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          {isManager && (
            <Button size="sm" onClick={() => openModal("createTask")}>
              <Plus className="w-4 h-4 mr-1.5" /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> My Tasks
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <FileCheck className="w-3.5 h-3.5" /> Compliance
            {complianceTasks && complianceTasks.filter((t) => !t.is_completed).length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-medium">
                {complianceTasks.filter((t) => !t.is_completed).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.overdue.length > 0 && (
                <TaskGroup label="Overdue" tasks={grouped.overdue} color="text-red-600 dark:text-red-400"
                  isManager={isManager} onComplete={(id) => completeTask.mutate(id)} onDelete={(id) => deleteTask.mutate(id)} onOpen={openTask} />
              )}
              {grouped.pending_approval.length > 0 && (
                <TaskGroup label="Pending Approval" tasks={grouped.pending_approval} color="text-orange-600 dark:text-orange-400"
                  isManager={isManager} onComplete={(id) => completeTask.mutate(id)} onDelete={(id) => deleteTask.mutate(id)} onOpen={openTask} />
              )}
              {grouped.in_progress.length > 0 && (
                <TaskGroup label="In Progress" tasks={grouped.in_progress} color="text-blue-600 dark:text-blue-400"
                  isManager={isManager} onComplete={(id) => completeTask.mutate(id)} onDelete={(id) => deleteTask.mutate(id)} onOpen={openTask} />
              )}
              {grouped.pending.length > 0 && (
                <TaskGroup label="Pending" tasks={grouped.pending} color="text-yellow-600 dark:text-yellow-400"
                  isManager={isManager} onComplete={(id) => completeTask.mutate(id)} onDelete={(id) => deleteTask.mutate(id)} onOpen={openTask} />
              )}
              {grouped.completed.length > 0 && (
                <TaskGroup label="Completed" tasks={grouped.completed} color="text-green-600 dark:text-green-400"
                  isManager={isManager} onComplete={(id) => completeTask.mutate(id)} onDelete={(id) => deleteTask.mutate(id)} onOpen={openTask} />
              )}
              {(tasksData?.total ?? 0) === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No tasks found</p>
                </div>
              )}
              {tasksData && tasksData.pages > 1 && (
                <Pagination page={tasksData.page} pages={tasksData.pages} total={tasksData.total} limit={tasksData.limit} onPageChange={setTaskPage} />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          {complianceLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (complianceTasks?.length ?? 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No compliance tasks found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {complianceTasks?.map((task, i) => <ComplianceTaskRow key={task.id} task={task} index={i} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Task Detail Sheet ── */}
      <Sheet open={!!selectedTask} onOpenChange={(o) => { if (!o) { setSelectedTask(null); setEditMode(false); } }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="pr-6">{selectedTask?.title}</SheetTitle>
            <SheetDescription asChild>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {selectedTask && (
                  <>
                    <Badge className={cn("text-[10px] px-1.5 py-0", getPriorityColor(selectedTask.priority))}>
                      {selectedTask.priority}
                    </Badge>
                    <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(selectedTask.status))}>
                      {selectedTask.status.replace(/_/g, " ")}
                    </Badge>
                    {isManager && !editMode && selectedTask.status !== "completed" && (
                      <button
                        className="ml-1 text-[10px] text-primary hover:underline flex items-center gap-0.5"
                        onClick={() => selectedTask && startEditTask(selectedTask)}
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </>
                )}
              </div>
            </SheetDescription>
          </SheetHeader>

          {editMode && selectedTask ? (
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input {...editForm.register("title")} />
                  {editForm.formState.errors.title && (
                    <p className="text-xs text-destructive">{editForm.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea {...editForm.register("description")} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={editForm.watch("priority")}
                      onValueChange={(v) => editForm.setValue("priority", v as TaskForm["priority"])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date</Label>
                    <Input type="datetime-local" {...editForm.register("due_date")} />
                    {editForm.formState.errors.due_date && (
                      <p className="text-xs text-destructive">{editForm.formState.errors.due_date.message}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Assign To</Label>
                  <Select
                    value={editForm.watch("assigned_to_id") ?? "none"}
                    onValueChange={(v) => editForm.setValue("assigned_to_id", v === "none" ? undefined : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {employeeData?.items?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SheetBody>
              <SheetFooter>
                <Button type="button" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                <Button type="submit" disabled={updateTask.isPending}>
                  {updateTask.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </SheetFooter>
            </form>
          ) : (
            <>
              <SheetBody className="space-y-4">
                {selectedTask?.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedTask?.assigned_to_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned To</p>
                      <p className="font-medium">{selectedTask.assigned_to_name}</p>
                    </div>
                  )}
                  {selectedTask?.department_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="font-medium">{selectedTask.department_name}</p>
                    </div>
                  )}
                  {selectedTask?.due_date && (
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="font-medium">{formatDate(selectedTask.due_date)}</p>
                    </div>
                  )}
                  {selectedTask?.created_by_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Created By</p>
                      <p className="font-medium">{selectedTask.created_by_name}</p>
                    </div>
                  )}
                </div>

                {selectedTask?.completion_note && (
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3">
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">Completion Note</p>
                    <p className="text-sm">{selectedTask.completion_note}</p>
                    {selectedTask.completion_submitted_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Submitted {formatDate(selectedTask.completion_submitted_at)}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Updates / Comments ── */}
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updates</p>
                  {taskComments && taskComments.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {taskComments.map((c) => {
                        const isManagerComment = c.employee_role?.toLowerCase().includes("manager") || c.employee_role?.toLowerCase().includes("admin");
                        return (
                          <div key={c.id} className={cn(
                            "rounded-lg p-2.5 text-sm",
                            isManagerComment
                              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800"
                              : "bg-muted",
                          )}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-medium text-xs">{c.employee_name}</span>
                              {isManagerComment && (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{c.employee_role}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(c.created_at)}</span>
                            </div>
                            <p className="text-xs whitespace-pre-wrap">{c.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No updates yet.</p>
                  )}
                  {selectedTask?.status !== "completed" && (
                    <div className="flex gap-2 pt-1">
                      <Textarea
                        placeholder="Post an update..."
                        rows={2}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="text-xs resize-none"
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                      />
                      <Button size="sm" className="self-end shrink-0" onClick={handleAddComment} disabled={!commentText.trim() || addComment.isPending}>
                        {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Attachments ── */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" /> Attachments
                      {taskAttachments && taskAttachments.length > 0 && (
                        <span className="bg-muted rounded-full px-1.5 py-0.5 text-xs font-normal">{taskAttachments.length}</span>
                      )}
                    </p>
                    {selectedTask?.status !== "completed" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={uploadAttachment.isPending}
                          onClick={() => attachFileRef.current?.click()}
                        >
                          {uploadAttachment.isPending
                            ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            : <Plus className="w-3 h-3 mr-1" />}
                          Attach
                        </Button>
                        <input
                          ref={attachFileRef}
                          type="file"
                          className="hidden"
                          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadAttachment.mutate(f);
                            if (attachFileRef.current) attachFileRef.current.value = "";
                          }}
                        />
                      </>
                    )}
                  </div>
                  {taskAttachments && taskAttachments.length > 0 ? (
                    <div className="space-y-1.5">
                      {taskAttachments.map((att: TaskAttachment) => (
                        <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/60 border border-border hover:bg-muted transition-colors">
                          <div className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center shrink-0">
                            {att.file_type.startsWith("image/") ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                              : att.file_type === "application/pdf" ? <FileText className="w-3.5 h-3.5 text-red-500" />
                              : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{att.filename}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {(att.file_size / 1024).toFixed(0)} KB · {att.uploaded_by_name ?? "Unknown"} · {formatDate(att.created_at)}
                            </p>
                          </div>
                          <button
                            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            onClick={() => api.tasks.attachments.download(selectedTask!.id, att.id, att.filename)}
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No attachments yet.</p>
                  )}
                </div>

                {canSubmit && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold">Submit for Approval</p>
                    <Textarea
                      placeholder="Describe what you completed (optional)..."
                      rows={3}
                      value={completionNote}
                      onChange={(e) => setCompletionNote(e.target.value)}
                    />
                  </div>
                )}

                {canApproveReject && showRejectInput && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-destructive">Reason for Rejection</p>
                    <Textarea
                      placeholder="Tell the employee what needs to be done..."
                      rows={3}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                    />
                  </div>
                )}
              </SheetBody>

              <SheetFooter>
                {canSubmit && (
                  <Button className="w-full" onClick={handleSubmitCompletion} disabled={submitCompletion.isPending}>
                    {submitCompletion.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Submit for Approval
                  </Button>
                )}

                {isMyTask && selectedTask?.status === "pending_approval" && (
                  <p className="text-sm text-center text-orange-600 dark:text-orange-400 w-full">
                    Waiting for manager approval…
                  </p>
                )}

                {canApproveReject && !showRejectInput && (
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => setShowRejectInput(true)}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button className="flex-1" onClick={handleApprove} disabled={approveTask.isPending}>
                      {approveTask.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                )}
                {canApproveReject && showRejectInput && (
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" className="flex-1" onClick={() => setShowRejectInput(false)}>Cancel</Button>
                    <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={rejectTask.isPending}>
                      {rejectTask.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                      Send Back
                    </Button>
                  </div>
                )}

                {selectedTask?.status === "completed" && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 w-full justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Task Completed</span>
                  </div>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Create Task Sheet ── */}
      <Sheet open={modals["createTask"]} onOpenChange={(o) => !o && closeModal("createTask")}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create New Task</SheetTitle>
            <SheetDescription>Add a task and assign priority or due date.</SheetDescription>
          </SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <SheetBody className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input {...form.register("title")} placeholder="Task title..." />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea {...form.register("description")} placeholder="Optional description..." rows={3} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Assign To</Label>
                  <Select
                    value={watchedAssignedTo ?? "none"}
                    onValueChange={(v) => form.setValue("assigned_to_id", v === "none" ? undefined : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {employeeData?.items?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select
                    value={watchedDepartment ?? "none"}
                    onValueChange={(v) => form.setValue("department_id", v === "none" ? undefined : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {departments?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select defaultValue="medium" onValueChange={(v) => form.setValue("priority", v as TaskForm["priority"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input
                    type="datetime-local"
                    min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    {...form.register("due_date")}
                  />
                  {form.formState.errors.due_date && (
                    <p className="text-xs text-destructive">{form.formState.errors.due_date.message}</p>
                  )}
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => closeModal("createTask")}>Cancel</Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                Create Task
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Task Group ────────────────────────────────────────────────────────────────

function TaskGroup({
  label, tasks, color, isManager, onComplete, onDelete, onOpen,
}: {
  label: string;
  tasks: Task[];
  color: string;
  isManager: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (task: Task) => void;
}) {
  return (
    <div>
      <h3 className={cn("text-sm font-semibold mb-2 flex items-center gap-2", color)}>
        {label}
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-normal">
          {tasks.length}
        </span>
      </h3>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => onOpen(task)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Complete circle — managers only */}
                  {isManager ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); task.status !== "completed" && onComplete(task.id); }}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                        task.status === "completed" ? "border-green-500 bg-green-500" : "border-muted-foreground/30 hover:border-primary",
                      )}
                    >
                      {task.status === "completed" && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  ) : (
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                      task.status === "completed" ? "border-green-500 bg-green-500" : "border-muted-foreground/30",
                    )}>
                      {task.status === "completed" && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", task.status === "completed" && "line-through text-muted-foreground")}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge className={cn("text-[10px] px-1.5 py-0", getPriorityColor(task.priority))}>
                        {task.priority}
                      </Badge>
                      <Badge className={cn("text-[10px] px-1.5 py-0", getStatusColor(task.status))}>
                        {task.status.replace(/_/g, " ")}
                      </Badge>
                      {task.department_name && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-violet-600 border-violet-300 dark:border-violet-700 dark:text-violet-400">
                          {task.department_name}
                        </Badge>
                      )}
                      {task.due_date && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDate(task.due_date)}
                        </span>
                      )}
                      {task.extension_requested && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300 dark:border-orange-700 dark:text-orange-400">
                          Extension requested
                        </Badge>
                      )}
                    </div>
                    {task.assigned_to_name && (
                      <p className="text-[11px] text-muted-foreground mt-2">Assigned to: {task.assigned_to_name}</p>
                    )}
                  </div>
                  {/* Delete button — managers only */}
                  {isManager && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Compliance Task Row ───────────────────────────────────────────────────────

function ComplianceTaskRow({ task, index }: { task: ComplianceTask; index: number }) {
  const isOverdue = !task.is_completed && new Date(task.due_date) < new Date();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Card className={cn("hover:shadow-sm transition-shadow", isOverdue && "border-red-200 dark:border-red-800", task.is_completed && "opacity-60")}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              task.is_completed ? "bg-green-100 dark:bg-green-900/30" : isOverdue ? "bg-red-100 dark:bg-red-900/30" : "bg-muted")}>
              {task.is_completed ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : isOverdue ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : (
                <Clock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", task.is_completed && "line-through")}>{task.title}</p>
              {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {task.category && (
                  <Badge className={cn("text-[10px] px-1.5 py-0 border-0 uppercase", CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.other)}>
                    {task.category}
                  </Badge>
                )}
                {task.recurrence && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{task.recurrence}</Badge>
                )}
                <span className={cn("text-[10px] flex items-center gap-1", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                  <Clock className="w-3 h-3" />
                  {task.is_completed ? "Completed" : isOverdue ? "Overdue · " : "Due · "}{formatDate(task.due_date)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
