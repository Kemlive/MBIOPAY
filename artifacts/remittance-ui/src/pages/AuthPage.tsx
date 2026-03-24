import { useState, useRef, useEffect } from "react";
import { Mail, Lock, User, Eye, EyeOff, Loader2, ShieldCheck, RefreshCw, ArrowLeft, Smartphone, Key, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

type Mode = "login" | "signup";

function getInitialMode(): Mode {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") return "signup";
  }
  return "login";
}

function getResetToken(): string | null {
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get("reset");
  }
  return null;
}

// ─── Password Strength ────────────────────────────────────────────────────────
type Rule = { label: string; test: (p: string) => boolean };
const PASSWORD_RULES: Rule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "Number (0-9)", test: (p) => /[0-9]/.test(p) },
  { label: "Special character (!@#...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const pct = (passed / PASSWORD_RULES.length) * 100;
  const color = passed <= 1 ? "#ef4444" : passed <= 3 ? "#f59e0b" : "#00c853";
  const label = passed <= 1 ? "Weak" : passed <= 3 ? "Fair" : passed === 4 ? "Good" : "Strong";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden mr-3">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>
      <div className="space-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <div key={rule.label} className="flex items-center gap-1.5">
              {ok
                ? <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                : <XCircle className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
              }
              <span className={`text-xs ${ok ? "text-primary" : "text-muted-foreground/60"}`}>{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-3 mb-8">
      <img src="/images/logo-icon.png" alt="MBIO PAY" className="h-12 w-12 rounded-2xl object-cover shadow-lg shadow-primary/30" />
      <div className="flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold text-foreground">MBIO</span>
        <span className="font-display text-2xl font-bold text-primary">PAY</span>
      </div>
    </div>
  );
}

// ─── Main Auth Page ───────────────────────────────────────────────────────────
export default function AuthPage() {
  const { login, signup, stage, pendingEmail, pendingTOTP, verifyEmail, resendVerification, resetStage } = useAuth();
  const [mode, setMode] = useState<Mode>(getInitialMode);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const resetToken = getResetToken();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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

  if (resetToken) {
    return <ResetPasswordStep token={resetToken} />;
  }

  if (showForgotPassword) {
    return <ForgotPasswordStep onBack={() => setShowForgotPassword(false)} />;
  }

  if (stage === "verify-email") {
    return <VerifyEmailStep email={pendingEmail!} onBack={resetStage} />;
  }

  if (stage === "totp") {
    return <TOTPLoginStep onBack={resetStage} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Logo />

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex bg-secondary/50 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); }}
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"} required
                placeholder={mode === "signup" ? "Create a strong password" : "Your password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === "signup" && <PasswordStrength password={password} />}
          </div>

          {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-3 py-2">{error}</div>}

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

      <p className="text-muted-foreground text-xs mt-6">Digital to UGX mobile money</p>
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

// ─── Forgot Password Step ─────────────────────────────────────────────────────
function ForgotPasswordStep({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Logo />
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </button>

        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-2">Check your inbox</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for <strong className="text-foreground">{email}</strong>, you will receive a password reset link within a few minutes.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-3">The link expires in 1 hour.</p>
            <button
              onClick={onBack}
              className="mt-6 w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Forgot your password?</h2>
                <p className="text-xs text-muted-foreground">We'll send you a reset link</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Enter the email address associated with your account and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email" required placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-3 py-2">{error}</div>}
              <button
                type="submit" disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reset Password Step ──────────────────────────────────────────────────────
function ResetPasswordStep({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const allRulesPassed = PASSWORD_RULES.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!allRulesPassed) {
      setError("Please meet all password requirements");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Logo />
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-2">Password updated</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your password has been changed successfully. All existing sessions have been signed out.
            </p>
            <a
              href="/auth"
              className="mt-6 w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center hover:bg-primary/90 transition-colors"
            >
              Sign In
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Set a new password</h2>
                <p className="text-xs text-muted-foreground">Choose a strong password</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"} required
                    placeholder="Create a strong password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"} required
                    placeholder="Re-enter your password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full bg-input/50 border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
                      confirmPassword && confirmPassword !== password ? "border-destructive" : "border-border"
                    }`}
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl px-3 py-2">{error}</div>}

              <button
                type="submit" disabled={loading || !allRulesPassed || password !== confirmPassword}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Saving..." : "Set New Password"}
              </button>
            </form>
          </>
        )}
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
      <Logo />
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
      <Logo />
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
