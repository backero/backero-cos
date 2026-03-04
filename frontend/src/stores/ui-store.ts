"use client";

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Modal states
  modals: Record<string, boolean>;

  // Active filters per page
  filters: Record<string, Record<string, string>>;

  // Notification count
  notificationCount: number;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;

  openModal: (key: string) => void;
  closeModal: (key: string) => void;
  toggleModal: (key: string) => void;

  setFilter: (page: string, key: string, value: string) => void;
  clearFilters: (page: string) => void;

  setNotificationCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  modals: {},
  filters: {},
  notificationCount: 0,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  openModal: (key) => set((s) => ({ modals: { ...s.modals, [key]: true } })),
  closeModal: (key) => set((s) => ({ modals: { ...s.modals, [key]: false } })),
  toggleModal: (key) => set((s) => ({ modals: { ...s.modals, [key]: !s.modals[key] } })),

  setFilter: (page, key, value) =>
    set((s) => ({
      filters: {
        ...s.filters,
        [page]: { ...(s.filters[page] || {}), [key]: value },
      },
    })),
  clearFilters: (page) =>
    set((s) => ({ filters: { ...s.filters, [page]: {} } })),

  setNotificationCount: (count) => set({ notificationCount: count }),
}));
