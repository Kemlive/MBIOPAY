import { ArrowLeft, Shield, FileText, AlertTriangle, Scale, RefreshCw, Phone, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const SECTIONS = [
  {
    icon: FileText,
    title: "Service Description",
    id: "service",
    content: "MBIO Pay provides a regulated platform for converting supported digital assets (USDT TRC-20) into mobile money payouts via MTN and Airtel Uganda. We act as an intermediary between the blockchain network and licensed mobile money operators.",
  },
  {
    icon: Shield,
    title: "User Responsibility",
    id: "responsibility",
    content: "You are solely responsible for ensuring the accuracy of recipient phone numbers, networks, and wallet addresses before confirming any transaction. MBIO Pay will not be liable for losses arising from incorrect information provided by users. Double-check all details before confirming — transactions cannot be reversed once blockchain confirmation is received.",
  },
  {
    icon: RefreshCw,
    title: "Transactions",
    id: "transactions",
    bullets: [
      "All payouts are processed after receiving sufficient blockchain confirmations on the TRON network.",
      "Transactions are irreversible once the mobile money payout has been initiated.",
      "Deposit addresses are unique per order and expire after 30 minutes. Funds sent after expiry are handled according to our refund policy.",
      "MBIO Pay monitors all deposits automatically. You do not need to notify us after sending.",
    ],
  },
  {
    icon: Scale,
    title: "Fees & Exchange Rates",
    id: "fees",
    content: "Exchange rates and service fees are displayed before you confirm each transaction. Rates are locked for 3 minutes after quote generation. A service fee of up to 1% is applied on the USDT amount sent. The final UGX amount shown at confirmation is what the recipient will receive.",
  },
  {
    icon: AlertTriangle,
    title: "Risk & Compliance",
    id: "risk",
    bullets: [
      "MBIO Pay reserves the right to delay, reject, or freeze transactions where suspicious activity is detected.",
      "We implement automated fraud detection. Accounts that trigger risk thresholds may be suspended pending review.",
      "We comply with applicable AML/CFT regulations. Users must not use this platform for illegal transactions.",
      "We may share transaction information with regulatory authorities if required by law.",
    ],
  },
  {
    icon: Shield,
    title: "Limitation of Liability",
    id: "liability",
    content: "MBIO Pay is not responsible for delays or failures caused by third-party services, including blockchain networks, Flutterwave, mobile network operators, or internet infrastructure. Maximum liability in any case shall not exceed the transaction value for the order in question.",
  },
  {
    icon: RefreshCw,
    title: "Changes to Terms",
    id: "changes",
    content: "We may update these terms at any time. We will notify users of material changes via email or in-app notification. Continued use of the platform after updates constitutes acceptance of the revised terms. The date at the top of this page reflects the most recent revision.",
  },
  {
    icon: Phone,
    title: "Contact & Support",
    id: "contact",
    content: "For support, disputes, or questions about these terms, contact us at:",
    contact: "+1 213-510-5113",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Terms of Service</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 pb-20">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Shield className="w-3 h-3" /> Legal Agreement
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-3">Terms of Service</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
            Welcome to MBIO Pay. By accessing or using our platform, you agree to be bound by these terms. Please read them carefully before transacting.
          </p>
          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span className="bg-secondary/50 border border-border/50 rounded-full px-3 py-1">Last updated: March 2026</span>
            <span className="bg-secondary/50 border border-border/50 rounded-full px-3 py-1">Effective immediately</span>
          </div>
        </div>

        {/* Quick nav */}
        <div className="bg-secondary/20 border border-border/50 rounded-2xl p-4 mb-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents</p>
          <div className="grid grid-cols-2 gap-1">
            {SECTIONS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-1.5 px-2 rounded-lg hover:bg-primary/5">
                <span className="text-primary/60 font-mono w-4 shrink-0">{i + 1}.</span>
                <span className="truncate">{s.title}</span>
                <ChevronRight className="w-3 h-3 ml-auto shrink-0 opacity-40" />
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((s, i) => (
            <div key={s.id} id={s.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden scroll-mt-20">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 bg-secondary/20">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">§{i + 1}</span>
                    <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4">
                {s.content && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
                )}
                {s.bullets && (
                  <ul className="space-y-2">
                    {s.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.contact && (
                  <a href={`tel:${s.contact}`}
                    className="inline-flex items-center gap-2 mt-3 text-primary font-semibold text-sm hover:underline">
                    <Phone className="w-4 h-4" /> {s.contact}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span>MBIO PAY · Regulated digital asset exchange</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/terms" className="text-primary hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
