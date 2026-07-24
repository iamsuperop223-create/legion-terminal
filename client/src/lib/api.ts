export const API_URL = import.meta.env.VITE_API_URL || "https://legion-terminal-production.up.railway.app";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem("legion-token", token);
    else localStorage.removeItem("legion-token");
  }

  getToken(): string | null {
    if (!this.token) this.token = localStorage.getItem("legion-token");
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });

    if (res.status === 401) {
      this.setToken(null);
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async register(email: string, password: string, name?: string) {
    const data = await this.request<{ user: any; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ user: any; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<{ user: any }>("/api/auth/me");
  }

  async logout() {
    await this.request("/api/auth/logout", { method: "POST" });
    this.setToken(null);
  }

  async forgotPassword(email: string) {
    return this.request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  }

  async resetPassword(token: string, password: string) {
    return this.request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
  }

  // Accounts
  async getAccounts() {
    return this.request<{ accounts: any[] }>("/api/accounts");
  }

  async createAccount(data: { name: string; type?: string; balance?: number }) {
    return this.request<{ account: any }>("/api/accounts", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAccount(id: string, data: Record<string, any>) {
    return this.request<{ account: any }>(`/api/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteAccount(id: string) {
    return this.request(`/api/accounts/${id}`, { method: "DELETE" });
  }

  // Trades
  async getTrades(accountId?: string) {
    const q = accountId ? `?accountId=${accountId}` : "";
    return this.request<{ trades: any[] }>(`/api/trades${q}`);
  }

  async createTrade(data: Record<string, any>) {
    return this.request<{ trade: any }>("/api/trades", { method: "POST", body: JSON.stringify(data) });
  }

  async updateTrade(id: string, data: Record<string, any>) {
    return this.request<{ trade: any }>(`/api/trades/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteTrade(id: string) {
    return this.request(`/api/trades/${id}`, { method: "DELETE" });
  }

  async bulkSetFee(accountId: string, fee: number) {
    return this.request<{ updated: number }>("/api/trades/bulk-fee", {
      method: "POST",
      body: JSON.stringify({ accountId, fee }),
    });
  }

  async setTradeAttribute(tradeId: string, attributeDefinitionId: string, value: any) {
    return this.request(`/api/trades/${tradeId}/attributes`, {
      method: "POST",
      body: JSON.stringify({ attributeDefinitionId, value }),
    });
  }

  // Rules
  async getRules(accountId?: string) {
    const q = accountId ? `?accountId=${accountId}` : "";
    return this.request<{ rules: any[] }>(`/api/rules${q}`);
  }

  async createRule(data: Record<string, any>) {
    return this.request<{ rule: any }>("/api/rules", { method: "POST", body: JSON.stringify(data) });
  }

  async updateRule(id: string, data: Record<string, any>) {
    return this.request<{ rule: any }>(`/api/rules/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteRule(id: string) {
    return this.request(`/api/rules/${id}`, { method: "DELETE" });
  }

  // Attributes
  async getAttributes() {
    return this.request<{ attributes: any[] }>("/api/attributes");
  }

  async createAttribute(data: Record<string, any>) {
    return this.request<{ attribute: any }>("/api/attributes", { method: "POST", body: JSON.stringify(data) });
  }

  async updateAttribute(id: string, data: Record<string, any>) {
    return this.request<{ attribute: any }>(`/api/attributes/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteAttribute(id: string) {
    return this.request(`/api/attributes/${id}`, { method: "DELETE" });
  }

  // Journals
  async getJournals(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return this.request<{ entries: any[] }>(`/api/journals${q.toString() ? `?${q}` : ""}`);
  }

  async createJournal(data: Record<string, any>) {
    return this.request<{ entry: any }>("/api/journals", { method: "POST", body: JSON.stringify(data) });
  }

  async updateJournal(id: string, data: Record<string, any>) {
    return this.request<{ entry: any }>(`/api/journals/${id}`, { method: "PUT", body: JSON.stringify(data) });
  }

  async deleteJournal(id: string) {
    return this.request(`/api/journals/${id}`, { method: "DELETE" });
  }

  // Settings
  async getSettings() {
    return this.request<{ settings: any }>("/api/settings");
  }

  async updateSettings(data: Record<string, any>) {
    return this.request<{ settings: any }>("/api/settings", { method: "PUT", body: JSON.stringify(data) });
  }

  // Export
  async exportTradesCsv(accountId?: string) {
    const q = accountId ? `?accountId=${accountId}` : "";
    const token = this.getToken();
    const res = await fetch(`${API_URL}/api/export/trades/csv${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.blob();
  }

  async exportBackup() {
    const token = this.getToken();
    const res = await fetch(`${API_URL}/api/export/backup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.blob();
  }

  async importData(data: any) {
    return this.request("/api/export/import", { method: "POST", body: JSON.stringify(data) });
  }
}

export const api = new ApiClient();
