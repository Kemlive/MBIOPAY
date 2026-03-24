import { ArrowLeft, Shield, Lock, Eye, Database, Cookie, UserCheck, Phone, ChevronRight, Server } from "lucide-react";
import { Link } from "wouter";

const SECTIONS = [
  {
    icon: Database,
    title: "Information We Collect",
    id: "collect",
    bullets: [
      "Email address and username used to create your account.",
      "Transaction details including amounts, recipient phone numbers, network provider, deposit addresses, and TRON transaction IDs.",
      "Device fingerprint data (browser type, screen resolution) used for fraud detection and session security.",
      "Usage patterns and platform interactions for performance improvement.",
    ],
  },
  {
    icon: Eye,
    title: "How We Use Your Information",
    id: "use",
    bullets: [
      "To process and verify your USDT-to-mobile-money transactions.",
      "To verify recipient mobile money account names via our payment provider.",
      "To detect and prevent fraudulent activity using automated risk scoring.",
      "To maintain platform security, uptime, and performance.",
      "To communicate important account and transaction updates.",
    ],
  },
  {
    icon: Server,
    title: "Data Sharing",
    id: "sharing",
    content: "We do not sell, rent, or trade your personal data to third parties.",
    bullets: [
      "Flutterwave receives recipient phone numbers and network codes solely for the purpose of processing mobile money payouts.",
      "TronGrid / blockchain network nodes receive deposit wallet addresses for transaction monitoring — this data is public by nature of blockchain technology.",
      "Regulatory authorities may receive transaction data if required by applicable law.",
    ],
  },
  {
    icon: Lock,
    title: "Security Measures",
    id: "security",
    bullets: [
      "Passwords are hashed using bcrypt with a high work factor — we never store plaintext passwords.",
      "JWT tokens are short-lived (15 minutes) and rotate automatically via refresh tokens.",
      "Admin access requires both a password and a time-based one-time password (TOTP).",
      "All transactions are monitored in real-time by a multi-layer fraud detection system.",
      "Hot wallet private keys are stored encrypted and are never exposed to the application layer.",
      "All data is transmitted over TLS/HTTPS.",
    ],
  },
  {
    icon: Cookie,
    title: "Cookies & Sessions",
    id: "cookies",
    content: "We use session cookies strictly for maintaining authenticated sessions. We do not use tracking, advertising, or analytics cookies. The session cookie is HttpOnly and expires after 4 hours of inactivity.",
  },
  {
    icon: UserCheck,
    title: "Your Rights",
    id: "rights",
    bullets: [
      "Right to access — you may request a copy of the personal data we hold about you.",
      "Right to deletion — you may request deletion of your account and associated data. Transaction records may be retained for regulatory compliance.",
      "Right to correction — you may request correction of inaccurate personal data.",
      "To exercise any of these rights, contact our support team.",
    ],
  },
  {
    icon: Shield,
    title: "Data Retention",
    id: "retention",
    content: "Transaction records are retained for a minimum of 5 years in accordance with financial regulations. Account data is deleted within 30 days of a deletion request, subject to regulatory retention requirements.",
  },
  {
    icon: Phone,
    title: "Contact",
    id: "contact",
    content: "For privacy-related inquiries, data requests, or concerns:",
    contact: "+1 213-510-5113",
  },
];

export default function PrivacyPage() {
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
            <Lock className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Privacy Policy</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 pb-20">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Lock className="w-3 h-3" /> Data Protection
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-3">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
            MBIO Pay is committed to protecting your personal data. This policy explains what we collect, how we use it, and the rights you have over your information.
          </p>
          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span className="bg-secondary/50 border border-border/50 rounded-full px-3 py-1">Last updated: March 2026</span>
            <span className="bg-secondary/50 border border-border/50 rounded-full px-3 py-1">GDPR-aware</span>
          </div>
        </div>

        {/* Trust bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Lock, label: "Encrypted Storage", sub: "bcrypt + TLS" },
            { icon: Eye, label: "No Data Selling", sub: "We never sell your data" },
            { icon: Shield, label: "Fraud Protected", sub: "Real-time monitoring" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-secondary/20 border border-border/50 rounded-2xl p-3 text-center">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
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
              <div className="px-5 py-4 space-y-3">
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
                    className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
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
            <span>MBIO PAY · Your privacy is our priority</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
