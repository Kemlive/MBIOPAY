import { useState, useRef, useEffect } from "react";
import { Mail, Lock, User, Eye, EyeOff, Loader2, ShieldCheck, RefreshCw, ArrowLeft, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";

type Mode = "login" | "signup";

function getInitialMode(): Mode {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") return "signup";
  }
  return "login";
}

export default function AuthPage() {
  const { login, signup, stage, pendingEmail, pendingTOTP, verifyEmail, resendVerification, resetStage } = useAuth();
  const [mode, setMode] = useState<Mode>(getInitialMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, username, password);
      }
    } catch (err: any) {
      if (err.requiresVerification && err.email) {
        setError(err.message ?? "Please verify your email before signing in.");
      } else {
        setError(err.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  if (stage === "verify-email") {
    return <VerifyEmailStep email={pendingEmail!} onBack={resetStage} />;
  }

  if (stage === "totp") {
    return <TOTPLoginStep onBack={resetStage} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-3 mb-8">
        <img src="/images/logo-icon.png" alt="MBIO PAY" className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-primary/30" />
        <div className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-bold text-foreground">MBIO</span>
          <span className="font-display text-2xl font-bold text-primary">PAY</span>
        </div>
      </div>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex bg-secondary/50 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email" required placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text" required placeholder="e.g. john_doe" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"} required minLength={8}
                placeholder={mode === "signup" ? "Min 8 characters" : "Your password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-3 py-2">{error}</div>}
          {success && <div className="bg-primary/10 border border-primary/20 text-primary text-sm rounded-xl px-3 py-2">{success}</div>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === "login" ? (
            <>No account?{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} className="text-primary hover:underline">Sign up</button>
            </>
          ) : (
            <>Already have one?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="text-primary hover:underline">Sign in</button>
            </>
          )}
        </p>
      </div>

      <p className="text-muted-foreground text-xs mt-6">USDT (TRC-20) → UGX mobile money</p>
      <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground/60">
        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
        <span>·</span>
        <a href="tel:+12135105113" className="hover:text-primary transition-colors">Support</a>
      </div>
    </div>
  );
}

// ─── Email Verification Step ──────────────────────────────────────────────────
function VerifyEmailStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { verifyEmail, resendVerification } = useAuth();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const refs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    refs[0].current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    setError("");
    if (value && index < 5) refs[index + 1].current?.focus();
    if (next.every(d => d !== "")) {
      handleVerify(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      refs[5].current?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const fullCode = codeStr ?? code.join("");
    if (fullCode.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      await verifyEmail(fullCode);
    } catch (err: any) {
      setError(err.message ?? "Invalid code");
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => refs[0].current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setResendMsg("");
    try {
      await resendVerification();
      setResendMsg("A new code has been sent!");
      setCooldown(60);
    } catch (err: any) {
      setResendMsg(err.message ?? "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-3 mb-8">
        <img src="/images/logo-icon.png" alt="MBIO PAY" className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-primary/30" />
        <div className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-bold text-foreground">MBIO</span>
          <span className="font-display text-2xl font-bold text-primary">PAY</span>
        </div>
      </div>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Verify your email</h2>
            <p className="text-xs text-muted-foreground">Code sent to {email}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
          Enter the 6-digit code we sent to your email address. The code expires in 15 minutes.
        </p>

        <div className="flex gap-2 justify-center mb-5" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className={`w-11 h-12 text-center text-xl font-bold bg-input/50 border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all
                ${digit ? "border-primary/60 bg-primary/5" : "border-border"}
                ${error ? "border-destructive" : ""}
                disabled:opacity-50`}
            />
          ))}
        </div>

        {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-3 py-2 mb-4">{error}</div>}

        <button
          onClick={() => handleVerify()}
          disabled={loading || code.some(d => d === "")}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 mb-4"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Didn't receive a code?</p>
          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="text-xs text-primary hover:underline disabled:opacity-50 flex items-center gap-1.5 mx-auto"
          >
            {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          {resendMsg && <p className="text-xs text-primary mt-1.5">{resendMsg}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── TOTP Login Step ──────────────────────────────────────────────────────────
function TOTPLoginStep({ onBack }: { onBack: () => void }) {
  const { login, pendingTOTP } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTOTP) return;
    setError("");
    setLoading(true);
    try {
      await login(pendingTOTP.email, pendingTOTP.password, token);
    } catch (err: any) {
      setError(err.message ?? "Invalid code");
      setToken("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-3 mb-8">
        <img src="/images/logo-icon.png" alt="MBIO PAY" className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-primary/30" />
        <div className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-bold text-foreground">MBIO</span>
          <span className="font-display text-2xl font-bold text-primary">PAY</span>
        </div>
      </div>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Two-Factor Authentication</h2>
            <p className="text-xs text-muted-foreground">Enter the code from your authenticator app</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Authenticator Code</label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full bg-input/50 border border-border rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest text-foreground placeholder:text-muted-foreground/40 placeholder:text-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={loading || token.length < 6}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Verifying..." : "Confirm"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Open your authenticator app and enter the current 6-digit code for MBIO PAY.
        </p>
      </div>
    </div>
  );
}
