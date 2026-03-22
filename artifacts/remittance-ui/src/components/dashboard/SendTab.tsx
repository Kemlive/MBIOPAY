import { useState, useEffect } from "react";
import { useCreateOrder, useGetOrder } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeDisplay } from "@/components/ui/qr-code-display";
import { Copy, CheckCircle2, Phone, ArrowRight, Loader2, Landmark, SmartphoneNfc } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatNumber } from "@/lib/utils";

const formSchema = z.object({
  phone: z.string().regex(/^256\d{9}$/, "Must be a valid Uganda number (e.g. 256700000000)"),
  network: z.enum(["MTN", "Airtel"]),
});

type FormValues = z.infer<typeof formSchema>;

export function SendTab() {
  const [step, setStep] = useState<1 | 2>(1);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [depositAddress, setDepositAddress] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { network: "MTN", phone: "" },
  });

  const network = watch("network");

  const createOrder = useCreateOrder();
  
  // Poll order status if we are on step 2
  const { data: order } = useGetOrder(activeOrderId as number, {
    query: {
      enabled: step === 2 && !!activeOrderId,
      refetchInterval: (query) => {
        // Stop polling if completed or failed
        if (query.state.data?.status === "completed" || query.state.data?.status === "failed") {
          return false;
        }
        return 5000;
      }
    }
  });

  const onSubmit = (data: FormValues) => {
    createOrder.mutate({ data }, {
      onSuccess: (res) => {
        setActiveOrderId(res.orderId);
        setDepositAddress(res.address);
        setStep(2);
      },
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setStep(1);
    setActiveOrderId(null);
    setDepositAddress("");
    setValue("phone", "");
  };

  return (
    <div className="max-w-xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl font-display">New Transfer</CardTitle>
                <CardDescription>Enter the recipient details to get a deposit address.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Mobile Network</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setValue("network", "MTN")}
                        className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                          network === "MTN" 
                            ? "bg-primary/10 border-primary text-primary" 
                            : "bg-input/30 border-border text-muted-foreground hover:bg-input/60"
                        }`}
                      >
                        <SmartphoneNfc className="h-6 w-6" />
                        <span className="font-semibold">MTN Mobile Money</span>
                      </div>
                      <div
                        onClick={() => setValue("network", "Airtel")}
                        className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                          network === "Airtel" 
                            ? "bg-red-500/10 border-red-500 text-red-500" 
                            : "bg-input/30 border-border text-muted-foreground hover:bg-input/60"
                        }`}
                      >
                        <Landmark className="h-6 w-6" />
                        <span className="font-semibold">Airtel Money</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Recipient Phone Number</label>
                    <Input 
                      placeholder="256700000000" 
                      icon={<Phone className="h-5 w-5" />}
                      {...register("phone")}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full text-lg h-14" 
                    isLoading={createOrder.isPending}
                  >
                    Continue <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-primary/20 overflow-hidden relative">
              {order?.status === "completed" && (
                 <div className="absolute inset-0 bg-success/5 pointer-events-none z-0" />
              )}
              
              <CardHeader className="text-center relative z-10 border-b border-border/50 bg-secondary/20">
                <div className="flex items-center justify-between">
                   <div className="text-left">
                     <p className="text-sm text-muted-foreground">Order ID</p>
                     <p className="font-mono text-lg font-bold">#{activeOrderId?.toString().padStart(5, '0')}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-sm text-muted-foreground">Recipient</p>
                     <p className="font-medium">{watch("phone")}</p>
                   </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-8 relative z-10">
                
                {(!order || order.status === "waiting") && (
                  <div className="flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 bg-warning/10 text-warning px-4 py-2 rounded-full font-medium mb-8">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Awaiting USDT Deposit
                    </div>
                    
                    <QRCodeDisplay value={depositAddress} size={200} />
                    
                    <div className="w-full mt-8">
                      <p className="text-sm text-center text-muted-foreground mb-2">Send TRC-20 USDT to this address:</p>
                      <div className="flex items-center gap-2 bg-input/50 border border-border p-1 pl-4 rounded-xl">
                        <code className="text-[13px] text-primary flex-1 truncate">{depositAddress}</code>
                        <Button variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
                          {copied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {order?.status === "processing" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                      <div className="relative bg-primary/20 text-primary p-6 rounded-full">
                        <Loader2 className="h-10 w-10 animate-spin" />
                      </div>
                    </div>
                    <h3 className="mt-8 text-2xl font-display font-bold">Payment Received!</h3>
                    <p className="text-muted-foreground mt-2">
                      Received <span className="text-foreground font-medium">{formatNumber(order.amount ?? 0)} USDT</span>.
                      <br/>Processing mobile money payout...
                    </p>
                  </div>
                )}

                {order?.status === "completed" && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="bg-success/20 text-success p-6 rounded-full mb-6">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>
                    <h3 className="text-3xl font-display font-bold text-success">Transfer Complete</h3>
                    
                    <div className="w-full bg-secondary/30 rounded-xl p-6 mt-8 space-y-4 text-left border border-border/50">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Amount Received:</span>
                        <span className="font-medium">{formatNumber(order.amount ?? 0)} USDT</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Sent to Mobile:</span>
                        <span className="font-display font-bold text-xl text-primary">{formatCurrency(order.ugxAmount ?? 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Transaction ID:</span>
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[150px]">{order.txid}</span>
                      </div>
                    </div>
                    
                    <Button onClick={resetForm} className="mt-8 w-full" size="lg">
                      Start New Transfer
                    </Button>
                  </div>
                )}

                {order?.status === "failed" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-destructive/20 text-destructive p-6 rounded-full mb-6">
                      <AlertCircle className="h-12 w-12" />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-destructive">Payout Failed</h3>
                    <p className="text-muted-foreground mt-2">
                      We received your USDT but the mobile money transfer failed.
                      Please contact support with Order ID #{order.id}.
                    </p>
                    <Button onClick={resetForm} variant="outline" className="mt-8 w-full" size="lg">
                      Go Back
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
