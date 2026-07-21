import { create } from "zustand";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  init: async () => {
    try {
      const token = localStorage.getItem("legion-token");
      if (!token) {
        set({ loading: false });
        return;
      }
      api.setToken(token);
      const { user } = await api.getMe();
      set({ user, loading: false });
      connectSocket(token);
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    try {
      set({ error: null });
      const { user } = await api.login(email, password);
      set({ user });
      connectSocket(api.getToken()!);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  register: async (email, password, name) => {
    try {
      set({ error: null });
      const { user } = await api.register(email, password, name);
      set({ user });
      connectSocket(api.getToken()!);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } finally {
      disconnectSocket();
      set({ user: null });
    }
  },

  clearError: () => set({ error: null }),
}));
