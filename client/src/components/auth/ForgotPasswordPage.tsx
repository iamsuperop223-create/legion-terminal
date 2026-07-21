import { useState } from "react";
import { api } from "@/lib/api";
import { Shield } from "lucide-react";

interface Props {
  onBack: () => void;
}

export default function ForgotPasswordPage({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch {
      // ignore
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
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-textDim text-sm mt-1">Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-accent-green text-sm mb-4">If an account exists with that email, a reset link has been sent.</p>
            <button onClick={onBack} className="text-gold text-sm hover:underline">Back to login</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-surface2 border border-border rounded-lg px-4 py-3 text-text font-mono text-sm focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-gold text-[#1A1206] font-bold py-3 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "..." : "Send Reset Link"}
            </button>
            <button type="button" onClick={onBack} className="text-textDim text-sm hover:text-gold transition">
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
