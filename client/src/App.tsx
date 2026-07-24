import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useAppStore, setupSocketListeners } from "@/stores/appStore";
import LoginPage from "@/components/auth/LoginPage";
import ForgotPasswordPage from "@/components/auth/ForgotPasswordPage";
import Dashboard from "@/components/views/Dashboard";
import TradeLog from "@/components/views/TradeLog";
import CalendarView from "@/components/views/CalendarView";
import StatsView from "@/components/views/StatsView";
import RulesView from "@/components/views/RulesView";
import AttributesView from "@/components/views/AttributesView";
import JournalsView from "@/components/views/JournalsView";
import RollupsView from "@/components/views/RollupsView";
import EconCalendarView from "@/components/views/EconCalendarView";
import TopBar from "@/components/layout/TopBar";
import IconRail from "@/components/layout/IconRail";
import MobileNav from "@/components/layout/MobileNav";
import TradeModal from "@/components/trades/TradeModal";

type AuthView = "login" | "register" | "forgot";

export default function App() {
  const { user, loading, init } = useAuthStore();
  const { loadAccounts, loadTrades, loadRules, loadAttributes, loadJournals, loadSettings, activeAccountId } = useAppStore();
  const [view, setView] = useState("dashboard");
  const [authView, setAuthView] = useState<AuthView>("login");
  const [modalTrade, setModalTrade] = useState<any>(undefined);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (user) {
      setupSocketListeners();
      Promise.all([loadAccounts(), loadAttributes(), loadSettings()]).then(() => setDataLoaded(true));
    }
  }, [user]);

  useEffect(() => {
    if (dataLoaded && activeAccountId) {
      loadTrades();
      loadRules();
    }
  }, [dataLoaded, activeAccountId]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="text-textFaint text-sm font-mono">Loading...</div>
      </div>
    );
  }

  if (!user) {
    if (authView === "login") return <LoginPage onSwitch={() => setAuthView("register")} onForgot={() => setAuthView("forgot")} />;
    if (authView === "register") return <LoginPage isRegister onSwitch={() => setAuthView("login")} onForgot={() => setAuthView("login")} />;
    return <ForgotPasswordPage onBack={() => setAuthView("login")} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden font-sans bg-bg text-text">
      <TopBar onAddTrade={() => setModalTrade(null)} />
      <div className="flex flex-1 min-h-0">
        <IconRail view={view} setView={setView} />
        <main className="flex-1 overflow-y-auto">
          {view === "dashboard" && <Dashboard onEdit={(t) => setModalTrade(t)} />}
          {view === "log" && <TradeLog onEdit={(t) => setModalTrade(t)} />}
          {view === "calendar" && <CalendarView />}
          {view === "stats" && <StatsView />}
          {view === "rollups" && <RollupsView />}
          {view === "econ" && <EconCalendarView />}
          {view === "rules" && <RulesView />}
          {view === "attributes" && <AttributesView />}
          {view === "journals" && <JournalsView />}
        </main>
      </div>
      <MobileNav view={view} setView={setView} />
      {modalTrade !== undefined && (
        <TradeModal trade={modalTrade} onSave={() => setModalTrade(undefined)} onClose={() => setModalTrade(undefined)} />
      )}
    </div>
  );
}
