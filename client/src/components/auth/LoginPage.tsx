import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Shield } from "lucide-react";

interface Props {
  onSwitch: () => void;
  onForgot: () => void;
  isRegister?: boolean;
}

export default function LoginPage({ onSwitch, onForgot, isRegister }: Props) {
  const { login, register, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name || undefined);
      } else {
        await login(email, password);
      }
    } catch {
      // error is in store
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-4">
            <Shield className="text-gold" size={24} />
          </div>
          <h1 className="text-2xl font-bold">Legion Terminal</h1>
          <p className="text-textDim text-sm mt-1">{isRegister ? "Create your account" : "Welcome back"}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface2 border border-border rounded-lg px-4 py-3 text-text font-mono text-sm focus:outline-none focus:border-gold"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-surface2 border border-border rounded-lg px-4 py-3 text-text font-mono text-sm focus:outline-none focus:border-gold"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
            className="bg-surface2 border border-border rounded-lg px-4 py-3 text-text font-mono text-sm focus:outline-none focus:border-gold"
          />

          {error && (
            <div className="text-accent-red text-xs text-center bg-accent-red/10 p-2 rounded-lg" onClick={clearError}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-gold text-[#1A1206] font-bold py-3 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="flex flex-col items-center mt-6 gap-2 text-sm text-textDim">
          {!isRegister && (
            <button onClick={onForgot} className="hover:text-gold transition">Forgot password?</button>
          )}
          <button onClick={onSwitch} className="hover:text-gold transition">
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
