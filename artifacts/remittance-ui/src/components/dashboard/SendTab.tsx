import { useState, useEffect, useRef } from "react";
import { useCreateOrder, useGetOrder, useGetQuote, useGetWalletAddress } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeDisplay } from "@/components/ui/qr-code-display";
import {
  Copy, CheckCircle2, Phone, ArrowRight, Loader2, SmartphoneNfc,
  Landmark, AlertCircle, ArrowLeft, RefreshCw, Banknote, Percent,
  Clock, WifiOff, TimerOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

type Network = "MTN" | "Airtel";
type Step = 1 | 2 | 3;

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

  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [serviceReason, setServiceReason] = useState("");
  const serviceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsedAmount = parseFloat(usdtAmount) || 0;
  const [debouncedAmount, setDebouncedAmount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(parsedAmount), 600);
    return () => clearTimeout(t);
  }, [parsedAmount]);

  const checkServiceStatus = async () => {
    try {
      const data = await apiFetch("/api/service-status");
      setServiceAvailable(data.available);
      setServiceReason(data.reason ?? "");
    } catch {
      setServiceAvailable(false);
      setServiceReason("Could not reach service. Please check your connection.");
    }
  };

  useEffect(() => {
    checkServiceStatus();
    serviceCheckRef.current = setInterval(checkServiceStatus, 30000);
    return () => {
      if (serviceCheckRef.current) clearInterval(serviceCheckRef.current);
    };
  }, []);

  const { data: walletData } = useGetWalletAddress();

  const { data: liveQuote } = useGetQuote(
    { amount: debouncedAmount },
    { query: { enabled: debouncedAmount >= 1 && debouncedAmount <= 500, staleTime: 30000 } }
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

  const goTo = (next: Step, direction = 1) => {
    setDir(direction);
    setStep(next);
  };

  const handleGetQuote = async () => {
    let valid = true;
    setPhoneError("");
    setAmountError("");

    if (!phone || !/^256\d{9}$/.test(phone)) {
      setPhoneError("Enter a valid Uganda number (e.g. 256700000000)");
      valid = false;
    }
    if (!usdtAmount || parsedAmount <= 0) {
      setAmountError("Enter the USDT amount to send");
      valid = false;
    }
    if (!valid) return;

    await fetchQuote();
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
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                  ? "bg-primary/40 text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`h-0.5 w-8 rounded ${step > s ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        {/* ===== STEP 1: Form ===== */}
        {step === 1 && (
          <motion.div
            key="step1"
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
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
                      <p className="text-destructive/80 text-xs mt-0.5">
                        {serviceReason || "The payout service is temporarily offline."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Network selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mobile Network</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNetwork("MTN")}
                      className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                        network === "MTN"
                          ? "bg-yellow-500/10 border-yellow-500 text-yellow-400"
                          : "bg-input/30 border-border text-muted-foreground hover:bg-input/60"
                      }`}
                    >
                      <SmartphoneNfc className="h-6 w-6" />
                      <span className="font-semibold text-sm">MTN Mobile Money</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNetwork("Airtel")}
                      className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                        network === "Airtel"
                          ? "bg-red-500/10 border-red-500 text-red-400"
                          : "bg-input/30 border-border text-muted-foreground hover:bg-input/60"
                      }`}
                    >
                      <Landmark className="h-6 w-6" />
                      <span className="font-semibold text-sm">Airtel Money</span>
                    </button>
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
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/[^0-9]/g, ""));
                        setPhoneError("");
                      }}
                      className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">You Send (USDT)</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="number"
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                      value={usdtAmount}
                      onChange={(e) => {
                        setUsdtAmount(e.target.value);
                        setAmountError("");
                      }}
                      className="w-full bg-input/50 border border-border rounded-xl pl-10 pr-16 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">USDT</span>
                  </div>
                  {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                  {parsedAmount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {liveQuote
                        ? <>≈ <span className="text-foreground font-medium">{formatCurrency(liveQuote.payoutUGX)}</span> UGX &nbsp;·&nbsp; rate: {liveQuote.usdtRate.toLocaleString()} UGX/USDT</>
                        : "Fetching live rate…"
                      }
                    </p>
                  )}
                </div>

                <Button
                  className="w-full text-lg h-14"
                  onClick={handleGetQuote}
                  disabled={quoteFetching || serviceAvailable === false}
                  title={serviceAvailable === false ? serviceReason : undefined}
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

        {/* ===== STEP 2: Quote confirmation ===== */}
        {step === 2 && (
          <motion.div
            key="step2"
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl font-display">Confirm Transfer</CardTitle>
                <CardDescription>Review the breakdown before proceeding.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary card */}
                <div className="bg-secondary/30 rounded-xl border border-border/50 divide-y divide-border/50">
                  <div className="flex justify-between items-center px-4 py-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> You Send
                    </span>
                    <span className="font-medium">{formatNumber(quote?.usdtAmount ?? parsedAmount, 4)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Percent className="w-4 h-4" /> Fee (1%)
                    </span>
                    <span className="font-medium text-muted-foreground">−{formatNumber(quote?.fee ?? 0, 4)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Exchange Rate</span>
                    <span className="font-medium">1 USDT = {(quote?.usdtRate ?? 3700).toLocaleString()} UGX</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-4">
                    <span className="font-semibold">Recipient Gets</span>
                    <span className="text-2xl font-display font-bold text-primary">
                      {formatCurrency(quote?.payoutUGX ?? 0)} UGX
                    </span>
                  </div>
                </div>

                {/* Recipient info */}
                <div className="flex gap-3 text-sm">
                  <div className="flex-1 bg-secondary/30 rounded-xl border border-border/50 px-4 py-3">
                    <p className="text-muted-foreground text-xs mb-1">Phone</p>
                    <p className="font-medium">{phone}</p>
                  </div>
                  <div className="flex-1 bg-secondary/30 rounded-xl border border-border/50 px-4 py-3">
                    <p className="text-muted-foreground text-xs mb-1">Network</p>
                    <p className={`font-bold ${network === "MTN" ? "text-yellow-400" : "text-red-400"}`}>{network}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 border border-border/40 rounded-xl px-4 py-3">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  You'll have <span className="font-semibold text-foreground mx-1">30 minutes</span> to send the USDT once the order is created.
                </div>

                <Button
                  className="w-full text-lg h-14"
                  onClick={handleConfirm}
                  disabled={createOrder.isPending}
                >
                  {createOrder.isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                  ) : (
                    <>Confirm & Proceed <ArrowRight className="ml-2 h-5 w-5" /></>
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
          <motion.div
            key="step3"
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <Card className="border-primary/20 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Order</p>
                    <p className="font-mono text-lg font-bold">#{activeOrderId?.toString().padStart(5, "0")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Recipient</p>
                    <p className="font-medium text-sm">{phone}</p>
                    <p className={`text-xs font-bold ${network === "MTN" ? "text-yellow-400" : "text-red-400"}`}>{network}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Waiting — show payment instructions */}
                {(!order || order.status === "waiting") && !isExpired && (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-400 px-4 py-2 rounded-full font-medium text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Waiting for your payment...
                      </div>
                      {secondsLeft !== null && expiresAt && (
                        <CountdownBadge secondsLeft={secondsLeft} />
                      )}
                    </div>

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
                      <p className="text-xs text-orange-400 text-center">
                        Hurry! This order expires soon. Send your USDT now.
                      </p>
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
                    <p className="text-muted-foreground text-sm max-w-xs">
                      This order's 30-minute window has passed. No payment was detected, so no funds were moved.
                    </p>
                    <Button onClick={reset} variant="outline" className="w-full" size="lg">
                      Start New Transfer
                    </Button>
                  </div>
                )}

                {/* Processing */}
                {order?.status === "processing" && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                      <div className="relative bg-primary/20 text-primary p-6 rounded-full">
                        <RefreshCw className="h-10 w-10 animate-spin" />
                      </div>
                    </div>
                    <h3 className="text-xl font-display font-bold">Payment Received!</h3>
                    <p className="text-muted-foreground text-sm">
                      Received <span className="text-foreground font-medium">{formatNumber(order.amount ?? 0, 4)} USDT</span>.
                      <br />Processing your mobile money payout...
                    </p>
                  </div>
                )}

                {/* Completed */}
                {order?.status === "completed" && (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                    <div className="bg-primary/20 text-primary p-5 rounded-full">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>
                    <h3 className="text-3xl font-display font-bold text-primary">Transfer Complete!</h3>

                    <div className="w-full bg-secondary/30 rounded-xl p-4 space-y-3 text-left border border-border/50 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">USDT Received</span>
                        <span className="font-medium">{formatNumber(order.amount ?? 0, 4)} USDT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">UGX Sent</span>
                        <span className="font-display font-bold text-xl text-primary">{formatCurrency(order.ugxAmount ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sent to</span>
                        <span className="font-medium">{phone} ({network})</span>
                      </div>
                      {order.txid && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TX ID</span>
                          <span className="font-mono text-xs text-muted-foreground truncate max-w-[150px]">{order.txid}</span>
                        </div>
                      )}
                    </div>

                    <Button onClick={reset} className="w-full" size="lg">
                      New Transfer
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
                    <Button onClick={reset} variant="outline" className="w-full" size="lg">
                      Start Over
                    </Button>
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
