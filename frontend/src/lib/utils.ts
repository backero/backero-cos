import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, symbol = "₹"): string {
  return `${symbol}${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount)}`;
}

export function formatDate(dateStr: string | null | undefined, fmt = "dd MMM yyyy"): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd MMM yyyy, hh:mm a");
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "medium":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "low":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
    case "paid":
    case "delivered":
    case "present":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "in_progress":
    case "shipped":
    case "wfh":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "pending":
    case "planned":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "pending_approval":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "overdue":
    case "cancelled":
    case "absent":
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "half_day":
    case "returned":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
}

export function getPlatformColor(platform: string): string {
  switch (platform) {
    case "amazon":
      return "bg-orange-500";
    case "flipkart":
      return "bg-blue-500";
    case "meesho":
      return "bg-pink-500";
    case "website":
      return "bg-purple-500";
    case "offline":
      return "bg-gray-500";
    case "nykaa":
      return "bg-rose-500";
    case "myntra":
      return "bg-fuchsia-500";
    case "ajio":
      return "bg-red-600";
    case "snapdeal":
      return "bg-red-400";
    case "jiomart":
      return "bg-blue-700";
    case "zepto":
      return "bg-yellow-500";
    case "blinkit":
      return "bg-yellow-400";
    case "swiggy_instamart":
      return "bg-orange-600";
    case "indiamart":
      return "bg-green-600";
    default:
      return "bg-slate-500";
  }
}

export function getStockPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}
