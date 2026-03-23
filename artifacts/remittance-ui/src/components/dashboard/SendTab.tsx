import { useState, useEffect, useRef } from "react";
import { useCreateOrder, useGetOrder, useGetQuote, useGetWalletAddress } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeDisplay } from "@/components/ui/qr-code-display";
import {
  Copy, CheckCircle2, Phone, ArrowRight, Loader2, SmartphoneNfc,
  Landmark, AlertCircle, ArrowLeft, RefreshCw, Banknote, Percent,
  Clock, WifiOff, TimerOff, UserCheck, ShieldAlert, User,
  Shield, Zap, RotateCcw, Scan, Send, BadgeCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

type Network = "MTN" | "Airtel";
type Step = 1 | 2 | 3;

const MIN_USDT = 1;

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return secondsLeft;
}

function CountdownBadge({ secondsLeft }: { secondsLeft: number }) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft <= 5 * 60;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold ${
      secondsLeft === 0
        ? "bg-destructive/20 text-destructive"
        : isUrgent
        ? "bg-orange-500/15 text-orange-400 animate-pulse"
        : "bg-secondary text-muted-foreground"
    }`}>
      <Clock className="w-3.5 h-3.5" />
      {secondsLeft === 0 ? "Expired" : `${mins}:${secs.toString().padStart(2, "0")} remaining`}
    </div>
  );
}

const QUOTE_LOCK_SECS = 3 * 60; // 3-minute rate lock

function useQuoteLock(lockedAt: number | null) {
  const [secsLeft, setSecsLeft] = useState<number>(QUOTE_LOCK_SECS);
  useEffect(() => {
    if (!lockedAt) { setSecsLeft(QUOTE_LOCK_SECS); return; }
    const update = () => {
      const elapsed = Math.floor((Date.now() - lockedAt) / 1000);
      setSecsLeft(Math.max(0, QUOTE_LOCK_SECS - elapsed));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [lockedAt]);
  return secsLeft;
}

function QuoteLockBadge({ secsLeft }: { secsLeft: number }) {
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const pct = (secsLeft / QUOTE_LOCK_SECS) * 100;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
      secsLeft === 0
        ? "bg-destructive/10 border-destructive/30 text-destructive"
        : secsLeft <= 30
        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
        : "bg-primary/8 border-primary/20 text-primary"
    }`}>
      <div className="relative w-4 h-4 shrink-0">
        <svg viewBox="0 0 16 16" className="w-4 h-4 -rotate-90">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2"
            strokeDasharray={`${(pct / 100) * 37.7} 37.7`} strokeLinecap="round" />
        </svg>
      </div>
      {secsLeft === 0
        ? "Rate expired — go back to refresh"
        : <><span className="font-mono">{mins}:{secs.toString().padStart(2, "0")}</span> &nbsp;Rate locked</>}
    </div>
  );
}

const TRUST_BADGES = [
  { icon: Shield, label: "Funds Protected" },
  { icon: RotateCcw, label: "Auto-refund if Failed" },
  { icon: Zap, label: "~2 min Arrival" },
];

export function SendTab() {
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<Network>("MTN");
  const [usdtAmount, setUsdtAmount] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [depositAddress, setDepositAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Account name resolution
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [nameResolveFailed, setNameResolveFailed] = useState(false);
  const [nameResolveError, setNameResolveError] = useState("");
  const [resolvingName, setResolvingName] = useState(false);
  const [nameTestMode, setNameTestMode] = useState(false);
  const [quoteLockedAt, setQuoteLockedAt] = useState<number | null>(null);
  const quoteLockSecsLeft = useQuoteLock(step === 2 ? quoteLockedAt : null);

  // Auto-resolve when phone + network change (debounced)
  useEffect(() => {
    setResolvedName(null);
    setNameResolveFailed(false);
    setNameResolveError("");
    setNameTestMode(false);
    if (!/^256\d{9}$/.test(phone)) return;

    const t = setTimeout(async () => {
      setResolvingName(true);
      try {
        const data = await apiFetch(
          `/api/resolve-account?phone=${encodeURIComponent(phone)}&network=${encodeURIComponent(network)}`
        );
        if (data.verified && data.accountName) {
          setResolvedName(data.accountName);
          setNameResolveFailed(false);
          setNameTestMode(!!data.testMode);
        } else {
          setResolvedName(null);
          setNameResolveFailed(false);
          setNameTestMode(false);
        }
      } catch {
        setResolvedName(null);
        setNameResolveFailed(false);
        setNameTestMode(false);
      } finally {
        setResolvingName(false);
      }
    }, 800);

    return () => clearTimeout(t);
  }, [phone, network]);

  // Service status
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [serviceReason, setServiceReason] = useState("");
  const serviceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkServiceStatus = async () => {
    try {
      const data = await apiFetch("/api/service-status");
      setServiceAvailable(data.available);
      setServiceReason(data.reason ?? "");
    } catch {
      // Network error — don't block the user, let them try
      setServiceAvailable(null);
      setServiceReason("");
    }
  };

  useEffect(() => {
    checkServiceStatus();
    serviceCheckRef.current = setInterval(checkServiceStatus, 30000);
    return () => { if (serviceCheckRef.current) clearInterval(serviceCheckRef.current); };
  }, []);

  const parsedAmount = parseFloat(usdtAmount) || 0;
  const [debouncedAmount, setDebouncedAmount] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(parsedAmount), 600);
    return () => clearTimeout(t);
  }, [parsedAmount]);

  const { data: walletData } = useGetWalletAddress();

  const { data: liveQuote } = useGetQuote(
    { amount: debouncedAmount },
    { query: { enabled: debouncedAmount >= MIN_USDT && debouncedAmount <= 500, staleTime: 30000 } }
  );

  const { data: quote, isFetching: quoteFetching, refetch: fetchQuote } = useGetQuote(
    { amount: parsedAmount },
    { query: { enabled: false } }
  );

  const createOrder = useCreateOrder();

  const { data: order } = useGetOrder(activeOrderId as number, {
    query: {
      enabled: step === 3 && !!activeOrderId,
      refetchInterval: (q) => {
        const s = q.state?.data?.status;
        if (s === "completed" || s === "failed" || s === "expired") return false;
        return 5000;
      },
    },
  });

  const secondsLeft = useCountdown(expiresAt);

  const goTo = (next: Step, direction = 1) => { setDir(direction); setStep(next); };

  const handleGetQuote = async () => {
    let valid = true;
    setPhoneError("");
    setAmountError("");

    if (!phone || !/^256\d{9}$/.test(phone)) {
      setPhoneError("Enter a valid Uganda number (e.g. 256700000000)");
      valid = false;
    }
    if (!usdtAmount || parsedAmount < MIN_USDT) {
      setAmountError(`Minimum amount is ${MIN_USDT} USDT`);
      valid = false;
    }
    if (!valid) return;

    await fetchQuote();
    setQuoteLockedAt(Date.now());
    goTo(2);
  };

  const handleConfirm = () => {
    createOrder.mutate(
      { data: { phone, network, expectedUsdt: parsedAmount } },
      {
        onSuccess: (res) => {
          setActiveOrderId(res.orderId);
          setDepositAddress(res.address || walletData?.address || "");
          setExpiresAt((res as any).expiresAt ?? null);
          goTo(3);
        },
      }
    );
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setPhone("");
    setUsdtAmount("");
    setNetwork("MTN");
    setPhoneError("");
    setAmountError("");
    setActiveOrderId(null);
    setDepositAddress("");
    setExpiresAt(null);
    setResolvedName(null);
    setNameResolveFailed(false);
    setQuoteLockedAt(null);
    goTo(1, -1);
    checkServiceStatus();
  };

  const address = depositAddress || walletData?.address || "";
  const isExpired = order?.status === "expired" || (secondsLeft !== null && secondsLeft === 0 && order?.status === "waiting");

  return (
    <div className="max-w-xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === s ? "bg-primary text-primary-foreground"
              : step > s ? "bg-primary/40 text-primary-foreground"
              : "bg-secondary text-muted-foreground"
            }`}>
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`h-0.5 w-8 rounded ${step > s ? "bg-primary/40" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir}>

        {/* ===== STEP 1: Form ===== */}
        {step === 1 && (
          <motion.div key="step1" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl font-display">Send Money</CardTitle>
                <CardDescription>Enter recipient details and the amount to send.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Service unavailability banner */}
                {serviceAvailable === false && (
                  <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/25 rounded-xl px-4 py-3 text-sm">
                    <WifiOff className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive">Payouts unavailable</p>
                      <p className="text-destructive/80 text-xs mt-0.5">{serviceReason || "The payout service is temporarily offline."}</p>
                    </div>
                  </div>
                )}

                {/* Network selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mobile Network</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["MTN", "Airtel"] as Network[]).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNetwork(n)}
                        className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                          network === n
                            ? n === "MTN" ? "bg-yellow-500/10 border-yellow-500 text-yellow-400" : "bg-red-500/10 border-red-500 text-red-400"
                            : "bg-input/30 border-border text-muted-foreground hover:bg-input/60"
                        }`}
                      >
                        {n === "MTN" ? <SmartphoneNfc className="h-6 w-6" /> : <Landmark className="h-6 w-6" />}
                        <span className="font-semibold text-sm">{n === "MTN" ? "MTN Mobile Money" : "Airtel Money"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Recipient Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      placeholder="256700000000"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value.replace(/[^0-9]/g, "")); setPhoneError(""); }}
                      className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {/* Name resolution indicator inside the input */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {resolvingName && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                      {!resolvingName && resolvedName && <UserCheck className="w-4 h-4 text-primary" />}
                      {!resolvingName && nameResolveFailed && <ShieldAlert className="w-4 h-4 text-orange-400" />}
                    </div>
                  </div>
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}

                  {/* Resolved name preview */}
                  {resolvedName && !resolvingName && (
                    <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2">
                      <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs text-primary font-semibold tracking-wide">{resolvedName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {nameTestMode ? "test mode" : "verified by Flutterwave"}
                      </span>
                    </div>
                  )}
                  {nameResolveFailed && !resolvingName && (
                    <div className="flex items-center gap-2 bg-orange-500/8 border border-orange-500/20 rounded-lg px-3 py-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="text-xs text-orange-400">Could not verify name — double-check the number</span>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">You Send (USDT)</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="number"
                      placeholder={`Min ${MIN_USDT}.00`}
                      min={MIN_USDT}
                      step="0.01"
                      value={usdtAmount}
                      onChange={(e) => { setUsdtAmount(e.target.value); setAmountError(""); }}
                      className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-16 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">USDT</span>
                  </div>
                  {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                  {parsedAmount >= MIN_USDT && (
                    <p className="text-xs text-muted-foreground">
                      {liveQuote
                        ? <>≈ <span className="text-foreground font-medium">{formatCurrency(liveQuote.payoutUGX)}</span> UGX &nbsp;·&nbsp; rate: {liveQuote.usdtRate.toLocaleString()} UGX/USDT</>
                        : "Fetching live rate…"}
                    </p>
                  )}
                </div>

                <Button
                  className="w-full text-lg h-14"
                  onClick={handleGetQuote}
                  disabled={quoteFetching || serviceAvailable === false}
                >
                  {quoteFetching ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Getting Quote...</>
                  ) : serviceAvailable === false ? (
                    <><WifiOff className="mr-2 h-5 w-5" /> Service Unavailable</>
                  ) : (
                    <>Get Quote <ArrowRight className="ml-2 h-5 w-5" /></>
                  )}
                </Button>

              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ===== STEP 2: Quote + Name Confirmation ===== */}
        {step === 2 && (
          <motion.div key="step2" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <Card className="border-primary/20 overflow-hidden relative">
              {/* Rate lock header bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-secondary/30 border-b border-border/50">
                <p className="text-xs text-muted-foreground font-medium">Confirm Transfer</p>
                <QuoteLockBadge secsLeft={quoteLockSecsLeft} />
              </div>

              {/* Expired overlay */}
              {quoteLockSecsLeft === 0 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm rounded-xl">
                  <TimerOff className="w-10 h-10 text-destructive" />
                  <p className="text-lg font-display font-bold text-destructive">Rate Expired</p>
                  <p className="text-sm text-muted-foreground text-center px-8">The 3-minute rate lock has passed. Go back to get a fresh quote.</p>
                  <Button variant="outline" onClick={() => goTo(1, -1)} className="gap-2">
                    <RotateCcw className="w-4 h-4" /> Refresh Rate
                  </Button>
                </div>
              )}

              <CardContent className="space-y-4 pt-5">

                {/* Recipient name verification — most prominent element */}
                <div className={`rounded-xl border-2 p-4 ${
                  resolvedName
                    ? "border-primary/40 bg-primary/5"
                    : nameResolveFailed
                    ? "border-orange-500/30 bg-orange-500/5"
                    : "border-border/50 bg-secondary/20"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      resolvedName ? "bg-primary/20" : nameResolveFailed ? "bg-orange-500/20" : "bg-secondary"
                    }`}>
                      {resolvedName
                        ? <UserCheck className="w-5 h-5 text-primary" />
                        : nameResolveFailed
                        ? <ShieldAlert className="w-5 h-5 text-orange-400" />
                        : <User className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Recipient Account</p>
                      {resolvedName ? (
                        <>
                          <p className="font-bold text-foreground text-lg leading-tight">{resolvedName}</p>
                          <p className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {nameTestMode ? "Verified (Test Mode)" : "Verified by Flutterwave"}
                          </p>
                        </>
                      ) : nameResolveFailed ? (
                        <>
                          <p className="font-semibold text-orange-400">Name not verified</p>
                          <p className="text-xs text-orange-400/80 mt-0.5">{nameResolveError || "Ensure the phone number and network are correct"}</p>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-sm">Name unavailable</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{phone}</p>
                      <span className={`text-xs font-bold ${network === "MTN" ? "text-yellow-400" : "text-red-400"}`}>{network}</span>
                    </div>
                  </div>
                </div>

                {/* Summary breakdown */}
                <div className="bg-secondary/30 rounded-xl border border-border/50 divide-y divide-border/50">
                  <div className="flex justify-between items-center px-4 py-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><Banknote className="w-4 h-4" /> You Send</span>
                    <span className="font-medium">{formatNumber(quote?.usdtAmount ?? parsedAmount, 4)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-2"><Percent className="w-4 h-4" /> Fee (1%)</span>
                    <span className="font-medium text-muted-foreground">−{formatNumber(quote?.fee ?? 0, 4)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Exchange Rate</span>
                    <span className="font-medium">1 USDT = {(quote?.usdtRate ?? 3700).toLocaleString()} UGX</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-4">
                    <span className="font-semibold">Recipient Gets</span>
                    <span className="text-2xl font-display font-bold text-primary">{formatCurrency(quote?.payoutUGX ?? 0)} UGX</span>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="grid grid-cols-3 gap-2">
                  {TRUST_BADGES.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 bg-secondary/30 border border-border/40 rounded-xl py-3 px-2 text-center">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Unverified name warning */}
                {nameResolveFailed && (
                  <div className="flex items-start gap-2 text-sm bg-orange-500/8 border border-orange-500/25 rounded-xl px-4 py-3">
                    <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <p className="text-orange-300 text-xs leading-relaxed">
                      We couldn't verify the account name for this number. Please double-check before proceeding.
                    </p>
                  </div>
                )}

                <Button
                  className="w-full text-lg h-14"
                  onClick={handleConfirm}
                  disabled={createOrder.isPending || quoteLockSecsLeft === 0}
                >
                  {createOrder.isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating Order...</>
                  ) : resolvedName ? (
                    <><UserCheck className="mr-2 h-5 w-5" /> Confirm — Send to {resolvedName.split(" ")[0]}</>
                  ) : (
                    <>Confirm & Create Order <ArrowRight className="ml-2 h-5 w-5" /></>
                  )}
                </Button>

                <button
                  onClick={() => goTo(1, -1)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>

                {createOrder.isError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {(createOrder.error as any)?.message ?? "Failed to create order. Try again."}
                  </div>
                )}

              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ===== STEP 3: Payment + live status ===== */}
        {step === 3 && (
          <motion.div key="step3" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
            <Card className="border-primary/20 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Order</p>
                    <p className="font-mono text-lg font-bold">#{activeOrderId?.toString().padStart(5, "0")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Recipient</p>
                    {resolvedName && (
                      <p className="font-semibold text-sm text-foreground">{resolvedName}</p>
                    )}
                    <p className="font-medium text-xs text-muted-foreground">{phone}</p>
                    <p className={`text-xs font-bold ${network === "MTN" ? "text-yellow-400" : "text-red-400"}`}>{network}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">

                {/* Waiting */}
                {(!order || order.status === "waiting") && !isExpired && (
                  <div className="flex flex-col items-center space-y-5">

                    {/* Status + timer */}
                    <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                      <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-400 px-4 py-2 rounded-full font-medium text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Waiting for your USDT...
                      </div>
                      {secondsLeft !== null && expiresAt && <CountdownBadge secondsLeft={secondsLeft} />}
                    </div>

                    {/* What happens next — process pipeline */}
                    <div className="w-full bg-secondary/20 border border-border/40 rounded-xl overflow-hidden">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-1">What happens next</p>
                      {[
                        { icon: Scan, label: "TRON blockchain detected", sub: "We watch your deposit address every 15s", done: false, active: true },
                        { icon: BadgeCheck, label: "Deposit confirmed", sub: "3 block confirmations on TRON", done: false, active: false },
                        { icon: Send, label: `UGX sent to ${network}`, sub: resolvedName ? `${resolvedName} · ${phone}` : phone, done: false, active: false },
                      ].map((s, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 border-t border-border/30 first:border-t-0">
                          <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${s.active ? "bg-yellow-500/15 text-yellow-400" : "bg-secondary text-muted-foreground"}`}>
                            <s.icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${s.active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{s.sub}</p>
                          </div>
                          {s.active && <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin shrink-0 mt-1" />}
                        </div>
                      ))}
                    </div>

                    {resolvedName && (
                      <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2 text-xs w-full">
                        <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Sending to</span>
                        <span className="font-semibold text-primary">{resolvedName}</span>
                        <span className="ml-auto text-muted-foreground">{phone}</span>
                      </div>
                    )}

                    <p className="text-sm text-center text-muted-foreground">
                      Send exactly <span className="text-foreground font-semibold">{formatNumber(parsedAmount, 4)} USDT (TRC-20)</span> to:
                    </p>

                    <QRCodeDisplay value={address} size={200} />

                    <div className="w-full flex items-center gap-2 bg-input/50 border border-border p-1 pl-4 rounded-xl">
                      <code className="text-xs text-primary flex-1 truncate">{address}</code>
                      <Button variant="secondary" size="sm" onClick={() => handleCopy(address)} className="shrink-0">
                        {copied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>

                    {secondsLeft !== null && secondsLeft <= 5 * 60 && secondsLeft > 0 && (
                      <p className="text-xs text-orange-400 text-center animate-pulse">⚡ Hurry! This order expires soon. Send your USDT now.</p>
                    )}
                  </div>
                )}

                {/* Expired */}
                {(order?.status === "expired" || isExpired) && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <div className="bg-secondary/50 border border-border/50 p-5 rounded-full">
                      <TimerOff className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-foreground">Order Expired</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">This order's 30-minute window has passed. No payment was detected, so no funds were moved.</p>
                    <Button onClick={reset} variant="outline" className="w-full" size="lg">Start New Transfer</Button>
                  </div>
                )}

                {/* Processing */}
                {order?.status === "processing" && (
                  <div className="flex flex-col items-center justify-center space-y-5">
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                        <div className="relative bg-primary/20 text-primary p-5 rounded-full">
                          <RefreshCw className="h-8 w-8 animate-spin" />
                        </div>
                      </div>
                      <h3 className="text-xl font-display font-bold">Payment Received!</h3>
                      <p className="text-muted-foreground text-sm text-center">
                        <span className="text-foreground font-semibold">{formatNumber(order.amount ?? 0, 4)} USDT</span> confirmed — sending UGX now
                      </p>
                    </div>
                    {/* Pipeline: steps 1 & 2 done, step 3 active */}
                    <div className="w-full bg-secondary/20 border border-border/40 rounded-xl overflow-hidden">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-1">Processing</p>
                      {[
                        { icon: Scan, label: "USDT detected on TRON", sub: `${formatNumber(order.amount ?? 0, 4)} USDT received`, done: true, active: false },
                        { icon: BadgeCheck, label: "Deposit confirmed", sub: "3 block confirmations verified", done: true, active: false },
                        { icon: Send, label: `Sending UGX to ${network}`, sub: resolvedName ? `${resolvedName} · ${phone}` : phone, done: false, active: true },
                      ].map((s, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 border-t border-border/30 first:border-t-0">
                          <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${s.done ? "bg-primary/20 text-primary" : s.active ? "bg-yellow-500/15 text-yellow-400" : "bg-secondary text-muted-foreground"}`}>
                            {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${s.done ? "text-primary" : s.active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{s.sub}</p>
                          </div>
                          {s.active && <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin shrink-0 mt-1" />}
                          {s.done && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-1" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {order?.status === "completed" && (
                  <div className="flex flex-col items-center justify-center py-4 text-center space-y-5">
                    {/* Celebration animation */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-60" />
                      <div className="relative bg-primary/20 text-primary p-5 rounded-full">
                        <CheckCircle2 className="h-12 w-12" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-display font-bold text-primary">Money Sent!</h3>
                      <p className="text-muted-foreground text-sm mt-1">The UGX is on its way — arrives in ~2 minutes</p>
                    </div>

                    {/* UGX amount highlight */}
                    <div className="w-full bg-primary/8 border-2 border-primary/30 rounded-2xl py-5 px-4 flex flex-col items-center gap-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recipient Receives</p>
                      <p className="text-4xl font-display font-black text-primary">{formatCurrency(order.ugxAmount ?? 0)}</p>
                      <p className="text-xs font-bold text-primary/70">UGX · {network} Mobile Money</p>
                    </div>

                    <div className="w-full bg-secondary/30 rounded-xl divide-y divide-border/50 border border-border/50 text-sm">
                      {resolvedName && (
                        <div className="flex justify-between items-center px-4 py-3">
                          <span className="text-muted-foreground">Recipient</span>
                          <span className="font-semibold flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-primary" />{resolvedName}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium">{phone}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-muted-foreground">You Sent</span>
                        <span className="font-medium">{formatNumber(order.amount ?? 0, 4)} USDT</span>
                      </div>
                      {order.txid && (
                        <div className="flex justify-between items-center px-4 py-3">
                          <span className="text-muted-foreground">TX ID</span>
                          <span className="font-mono text-xs text-muted-foreground truncate max-w-[160px]">{order.txid}</span>
                        </div>
                      )}
                    </div>

                    <Button onClick={reset} className="w-full text-lg h-14" size="lg">
                      <RotateCcw className="mr-2 h-5 w-5" /> Send Again
                    </Button>
                  </div>
                )}

                {/* Failed */}
                {order?.status === "failed" && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <div className="bg-destructive/20 text-destructive p-5 rounded-full">
                      <AlertCircle className="h-12 w-12" />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-destructive">Payout Failed</h3>
                    <p className="text-muted-foreground text-sm">
                      We received your USDT but the mobile money transfer failed.
                      <br />Contact support with Order #{activeOrderId}.
                    </p>
                    <Button onClick={reset} variant="outline" className="w-full" size="lg">Start Over</Button>
                  </div>
                )}

              </CardContent>
            </Card>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
