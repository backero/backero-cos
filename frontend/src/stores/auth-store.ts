"use client";

import { create } from "zustand";
import type { AuthUser, Module, Permissions } from "@/types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  permissions: Permissions;
  _hasHydrated: boolean;

  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  initAuth: () => Promise<void>;

  // Permission helpers
  canView: (module: Module) => boolean;
  canCreate: (module: Module) => boolean;
  canEdit: (module: Module) => boolean;
  hasPermission: (module: Module) => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  permissions: {},
  _hasHydrated: false,

  setAuth: (user, accessToken) => {
    localStorage.setItem("access_token", accessToken);
    set({
      user,
      accessToken,
      isAuthenticated: true,
      permissions: (user.permissions as Permissions) ?? {},
    });
  },

  clearAuth: () => {
    localStorage.removeItem("access_token");
    set({ user: null, accessToken: null, isAuthenticated: false, permissions: {} });
  },

  updateUser: (partial) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
      permissions: partial.permissions
        ? (partial.permissions as Permissions)
        : state.permissions,
    })),

  /**
   * Called once on app boot. Reads the stored access token and validates it
   * against /auth/me. Populates user state on success, clears token on failure.
   * Always sets _hasHydrated=true so the app can render.
   */
  initAuth: async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    if (!token) {
      set({ _hasHydrated: true });
      return;
    }

    try {
      const { api } = await import("@/lib/api-client");
      const user = await api.auth.me();
      set({
        user,
        accessToken: token,
        isAuthenticated: true,
        permissions: (user.permissions as Permissions) ?? {},
        _hasHydrated: true,
      });
    } catch {
      localStorage.removeItem("access_token");
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        permissions: {},
        _hasHydrated: true,
      });
    }
  },

  canView:       (module) => !!get().permissions[module]?.can_view,
  canCreate:     (module) => !!get().permissions[module]?.can_create,
  canEdit:       (module) => !!get().permissions[module]?.can_edit,
  hasPermission: (module) => !!get().permissions[module]?.can_view,
}));
