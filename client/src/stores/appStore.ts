import { create } from "zustand";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { TradingAccount, Trade, Rule, AttributeDefinition, JournalEntry, UserSettings } from "@/types";

interface AppState {
  // Accounts
  accounts: TradingAccount[];
  activeAccountId: string | null;
  loadAccounts: () => Promise<void>;
  createAccount: (data: { name: string; type?: string; balance?: number }) => Promise<void>;
  updateAccount: (id: string, data: Record<string, any>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  setActiveAccount: (id: string) => void;

  // Trades
  trades: Trade[];
  loadTrades: () => Promise<void>;
  createTrade: (data: Record<string, any>) => Promise<void>;
  updateTrade: (id: string, data: Record<string, any>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;

  // Rules
  rules: Rule[];
  loadRules: () => Promise<void>;
  createRule: (data: Record<string, any>) => Promise<void>;
  updateRule: (id: string, data: Record<string, any>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;

  // Attributes
  attributes: AttributeDefinition[];
  loadAttributes: () => Promise<void>;
  createAttribute: (data: Record<string, any>) => Promise<void>;
  updateAttribute: (id: string, data: Record<string, any>) => Promise<void>;
  deleteAttribute: (id: string) => Promise<void>;

  // Journals
  journals: JournalEntry[];
  loadJournals: () => Promise<void>;
  createJournal: (data: Record<string, any>) => Promise<void>;
  updateJournal: (id: string, data: Record<string, any>) => Promise<void>;
  deleteJournal: (id: string) => Promise<void>;

  // Settings
  settings: UserSettings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (data: Record<string, any>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Accounts ───────────────────────────────────────────────────
  accounts: [],
  activeAccountId: null,

  loadAccounts: async () => {
    const { accounts } = await api.getAccounts();
    set({ accounts });
    const state = get();
    if (!state.activeAccountId && accounts.length > 0) {
      set({ activeAccountId: accounts[0].id });
    }
  },

  createAccount: async (data) => {
    await api.createAccount(data);
    await get().loadAccounts();
  },

  updateAccount: async (id, data) => {
    await api.updateAccount(id, data);
    await get().loadAccounts();
  },

  deleteAccount: async (id) => {
    await api.deleteAccount(id);
    const state = get();
    if (state.activeAccountId === id) {
      const remaining = state.accounts.filter((a) => a.id !== id);
      set({ activeAccountId: remaining[0]?.id || null });
    }
    await get().loadAccounts();
  },

  setActiveAccount: (id) => set({ activeAccountId: id }),

  // ─── Trades ────────────────────────────────────────────────────
  trades: [],

  loadTrades: async () => {
    const { activeAccountId } = get();
    const { trades } = await api.getTrades(activeAccountId || undefined);
    set({ trades });
  },

  createTrade: async (data) => {
    await api.createTrade(data);
    await get().loadTrades();
  },

  updateTrade: async (id, data) => {
    await api.updateTrade(id, data);
    await get().loadTrades();
  },

  deleteTrade: async (id) => {
    await api.deleteTrade(id);
    await get().loadTrades();
  },

  // ─── Rules ─────────────────────────────────────────────────────
  rules: [],

  loadRules: async () => {
    const { activeAccountId } = get();
    const { rules } = await api.getRules(activeAccountId || undefined);
    set({ rules });
  },

  createRule: async (data) => {
    await api.createRule({ ...data, accountId: get().activeAccountId });
    await get().loadRules();
  },

  updateRule: async (id, data) => {
    await api.updateRule(id, data);
    await get().loadRules();
  },

  deleteRule: async (id) => {
    await api.deleteRule(id);
    await get().loadRules();
  },

  // ─── Attributes ────────────────────────────────────────────────
  attributes: [],

  loadAttributes: async () => {
    const { attributes } = await api.getAttributes();
    set({ attributes });
  },

  createAttribute: async (data) => {
    await api.createAttribute(data);
    await get().loadAttributes();
  },

  updateAttribute: async (id, data) => {
    await api.updateAttribute(id, data);
    await get().loadAttributes();
  },

  deleteAttribute: async (id) => {
    await api.deleteAttribute(id);
    await get().loadAttributes();
  },

  // ─── Journals ──────────────────────────────────────────────────
  journals: [],

  loadJournals: async () => {
    const { entries } = await api.getJournals();
    set({ journals: entries });
  },

  createJournal: async (data) => {
    await api.createJournal(data);
    await get().loadJournals();
  },

  updateJournal: async (id, data) => {
    await api.updateJournal(id, data);
    await get().loadJournals();
  },

  deleteJournal: async (id) => {
    await api.deleteJournal(id);
    await get().loadJournals();
  },

  // ─── Settings ──────────────────────────────────────────────────
  settings: null,

  loadSettings: async () => {
    const { settings } = await api.getSettings();
    set({ settings });
  },

  updateSettings: async (data) => {
    await api.updateSettings(data);
    await get().loadSettings();
  },
}));

// ─── WebSocket listeners for real-time sync ─────────────────────────
export function setupSocketListeners() {
  const socket = getSocket();
  if (!socket) return;

  socket.on("trade:created", () => useAppStore.getState().loadTrades());
  socket.on("trade:updated", () => useAppStore.getState().loadTrades());
  socket.on("trade:deleted", () => useAppStore.getState().loadTrades());
}
