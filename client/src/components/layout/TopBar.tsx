import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { PlusCircle, ChevronDown, Settings, LogOut, X, Pencil } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { fmt$ } from "@/types";

const ACCOUNT_BADGES: Record<string, { bg: string; fg: string }> = {
  eval: { bg: "bg-[#3A2E18]", fg: "text-[#D4A24E]" },
  funded: { bg: "bg-[#1E5844]", fg: "text-[#38D9A0]" },
  sim: { bg: "bg-[#1a2a4a]", fg: "text-[#6FA8F5]" },
};

export default function TopBar({ onAddTrade }: { onAddTrade: () => void }) {
  const { accounts, activeAccountId, setActiveAccount, createAccount, updateAccount, deleteAccount, loadTrades, loadRules } = useAppStore();
  const { logout } = useAuthStore();
  const [showAccounts, setShowAccounts] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  const totalPnl = 0;

  return (
    <div className="h-[62px] border-b border-border flex items-center justify-between px-5 bg-bg flex-shrink-0">
      <div className="flex items-center gap-6">
        {/* Account Selector */}
        <div className="relative">
          <button
            onClick={() => setShowAccounts(!showAccounts)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface2 transition"
          >
            <div className={`w-2 h-2 rounded-full ${activeAccount?.type === "funded" ? "bg-[#38D9A0]" : activeAccount?.type === "eval" ? "bg-[#D4A24E]" : "bg-[#6FA8F5]"}`} />
            <span className="font-mono font-bold text-sm">{activeAccount?.name || "No Account"}</span>
            {activeAccount && (
              <span className="font-mono text-xs text-[#8891A3]">{fmt$(activeAccount.balance)}</span>
            )}
            <ChevronDown size={14} className="text-[#8891A3]" />
          </button>

          {showAccounts && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAccounts(false)} />
              <div className="absolute top-full left-0 mt-2 w-72 bg-[#11161F] border border-[#232B38] rounded-xl shadow-xl z-50 p-2">
                {accounts.map((acc) => {
                  const badge = ACCOUNT_BADGES[acc.type] || ACCOUNT_BADGES.sim;
                  return (
                    <div
                      key={acc.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${acc.id === activeAccountId ? "bg-[#1A2029]" : "hover:bg-[#1A2029]"}`}
                    >
                      <button
                        className="flex-1 flex items-center gap-3 text-left"
                        onClick={() => { setActiveAccount(acc.id); loadTrades(); loadRules(); setShowAccounts(false); }}
                      >
                        <div className={`w-2 h-2 rounded-full ${acc.type === "funded" ? "bg-[#38D9A0]" : acc.type === "eval" ? "bg-[#D4A24E]" : "bg-[#6FA8F5]"}`} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{acc.name}</div>
                          <div className="text-xs text-[#8891A3]">{fmt$(acc.balance)} · {acc._count?.trades || 0} trades</div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.bg} ${badge.fg}`}>
                          {acc.type}
                        </span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingAccount({ ...acc }); setShowAccounts(false); }}
                        className="text-[#5B6478] hover:text-[#E7EAEF] transition p-1"
                        title="Edit account"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  );
                })}
                <div className="border-t border-[#232B38] mt-1 pt-1">
                  <button
                    onClick={() => { setShowAccounts(false); setShowCreateModal(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#D4A24E] hover:bg-[#1A2029] rounded-lg transition"
                  >
                    <PlusCircle size={14} /> Add Account
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* All-Time PnL */}
        <div>
          <div className="text-[10px] text-[#5B6478] uppercase tracking-wider">All-Time PnL</div>
          <div className={`font-mono font-bold text-sm ${totalPnl >= 0 ? "text-[#38D9A0]" : "text-[#F1685E]"}`}>
            {fmt$(totalPnl)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-[#D4A24E] font-bold tracking-widest text-sm font-sans">LEGION TERMINAL</div>
        <button
          onClick={onAddTrade}
          className="flex items-center gap-1.5 bg-[#D4A24E] text-[#1A1206] font-bold text-xs px-3.5 py-2 rounded-lg hover:opacity-90 transition"
        >
          <PlusCircle size={14} /> Add Trade
        </button>
        <button onClick={logout} className="text-[#8891A3] hover:text-[#E7EAEF] transition" title="Logout">
          <LogOut size={16} />
        </button>
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <AccountModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <AccountModal account={editingAccount} onClose={() => setEditingAccount(null)} />
      )}
    </div>
  );
}

function AccountModal({ account, onClose }: { account?: any; onClose: () => void }) {
  const { createAccount, updateAccount, deleteAccount, loadAccounts, setActiveAccount, loadTrades, loadRules } = useAppStore();
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "sim");
  const [balance, setBalance] = useState(account?.balance?.toString() || "10000");
  const [loading, setLoading] = useState(false);

  const isEdit = !!account;

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await updateAccount(account.id, { name: name.trim(), type, balance: Number(balance) || 10000 });
      } else {
        const newAcc = await createAccount({ name: name.trim(), type, balance: Number(balance) || 10000 });
      }
      await loadAccounts();
      onClose();
    } catch (err) {
      console.error("Failed to save account:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this account and all its trades?")) return;
    await deleteAccount(account.id);
    await loadAccounts();
    onClose();
  };

  const inputCls = "bg-[#1A2029] border border-[#232B38] rounded-lg text-[#E7EAEF] px-3 py-2 text-sm font-mono w-full focus:outline-none focus:border-[#D4A24E]";
  const TYPES = [
    { value: "sim", label: "Sim", color: "text-[#6FA8F5]" },
    { value: "eval", label: "Eval", color: "text-[#D4A24E]" },
    { value: "funded", label: "Funded", color: "text-[#38D9A0]" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="w-96 bg-[#11161F] border border-[#232B38] rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold">{isEdit ? "Edit Account" : "New Account"}</h2>
          <button onClick={onClose} className="text-[#8891A3] hover:text-[#E7EAEF] transition"><X size={20} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-[#5B6478] uppercase tracking-wider mb-1 block">Account Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex 50K"
              className={inputCls}
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] text-[#5B6478] uppercase tracking-wider mb-1 block">Account Type</label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition border ${
                    type === t.value
                      ? `${t.color} border-current bg-current/10`
                      : "text-[#8891A3] border-[#232B38] bg-[#1A2029] hover:bg-[#232B38]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[#5B6478] uppercase tracking-wider mb-1 block">Account Size ($)</label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="flex-1 bg-[#D4A24E] text-[#1A1206] font-bold py-2.5 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-40"
          >
            {loading ? "..." : isEdit ? "Save Changes" : "Create Account"}
          </button>
          {isEdit && (
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[#F1685E] border border-[#F1685E]/30 hover:bg-[#F1685E]/10 transition"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
