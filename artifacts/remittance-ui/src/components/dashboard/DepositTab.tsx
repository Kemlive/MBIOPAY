import { useGetWalletAddress } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeDisplay } from "@/components/ui/qr-code-display";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { useState } from "react";

export function DepositTab() {
  const { data, isLoading } = useGetWalletAddress();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (data?.address) {
      navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-primary/20 shadow-2xl shadow-primary/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Deposit USDT</CardTitle>
          <CardDescription className="text-base mt-2">
            Send funds to this address to top up your master wallet.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center p-8 pt-4">
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex gap-3 text-warning-foreground mb-8 w-full">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Important</p>
              <p className="opacity-90 mt-1">Send ONLY USDT on the <strong>TRC-20 (TRON)</strong> network to this address. Sending other tokens or using other networks will result in permanent loss.</p>
            </div>
          </div>

          <QRCodeDisplay value={data?.address || ""} size={220} />
          
          <div className="w-full mt-8">
            <p className="text-sm text-muted-foreground mb-2 font-medium">Wallet Address (TRC-20)</p>
            <div className="flex items-center gap-2 bg-input/50 border border-border p-1 pl-4 rounded-xl">
              <code className="text-sm text-primary flex-1 truncate">{data?.address}</code>
              <Button 
                variant={copied ? "default" : "secondary"} 
                size="sm" 
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
