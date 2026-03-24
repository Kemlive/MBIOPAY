import { Link } from "wouter";
import {
  ArrowRight, Zap, Shield, Clock, Smartphone, CheckCircle2,
  ChevronRight, Globe, Lock, Star, TrendingUp,
} from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "Create your account",
    desc: "Sign up with your email and get started in seconds.",
    icon: Smartphone,
  },
  {
    step: "02",
    title: "Initiate your transfer",
    desc: "Enter the recipient's phone number, view the live rate, and follow the instructions to complete your payment.",
    icon: TrendingUp,
  },
  {
    step: "03",
    title: "Funds delivered",
    desc: "Your transfer is processed and delivered directly to the recipient's mobile money account.",
    icon: Zap,
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "~2 Minute Delivery",
    desc: "From blockchain confirmation to mobile wallet credit, your recipient gets paid in under 2 minutes.",
  },
  {
    icon: Lock,
    title: "Non-Custodial Quotes",
    desc: "Rates are locked for 3 minutes at the moment you confirm — no surprises at checkout.",
  },
  {
    icon: Shield,
    title: "Auto-Refund Protection",
    desc: "If a payout fails for any reason, funds are automatically returned. Your money is always safe.",
  },
  {
    icon: Globe,
    title: "MTN & Airtel Uganda",
    desc: "We support both major mobile money networks covering the entire country.",
  },
  {
    icon: CheckCircle2,
    title: "Name Verification",
    desc: "We verify the recipient's registered name before you confirm — zero misdirected payments.",
  },
  {
    icon: Star,
    title: "Transparent Fees",
    desc: "A flat service fee shown up front. No hidden charges, no surprise deductions.",
  },
];

const TESTIMONIALS = [
  {
    text: "Sent $200 USDT to my family in Kampala. Hit their Airtel wallet in under 3 minutes. Incredible.",
    name: "David M.",
    tag: "Regular sender",
  },
  {
    text: "Finally a crypto ramp that actually works in Uganda. No bank account needed on the receiving end.",
    name: "Sarah K.",
    tag: "Business owner",
  },
  {
    text: "The name verification before sending is a killer feature — I know my money goes to the right person.",
    name: "Peter O.",
    tag: "Freelancer",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo-icon.png" alt="MBIO PAY" className="h-9 w-9 rounded-xl object-cover shadow shadow-primary/20" />
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-lg font-bold text-foreground">MBIO</span>
              <span className="font-display text-lg font-bold text-primary">PAY</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth">
              <button className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium px-4 py-2 rounded-xl hover:bg-secondary/50">
                Sign In
              </button>
            </Link>
            <Link href="/auth?mode=signup">
              <button className="text-sm bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-primary/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3 h-3" /> USDT → Uganda Mobile Money in minutes
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-[1.1] mb-5 max-w-3xl mx-auto">
            Send money,{" "}
            <span className="text-primary">they receive instantly</span>
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto mb-8">
            Fast and reliable transfers delivered directly to MTN and Airtel mobile wallets — anytime, anywhere.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link href="/auth?mode=signup">
              <button className="w-full sm:w-auto bg-primary text-primary-foreground font-bold px-8 py-3.5 rounded-2xl hover:bg-primary/90 transition-all hover:scale-105 flex items-center justify-center gap-2 text-base shadow-lg shadow-primary/30">
                Start Sending <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/auth">
              <button className="w-full sm:w-auto border border-border text-foreground font-semibold px-8 py-3.5 rounded-2xl hover:border-primary/40 hover:bg-secondary/30 transition-colors text-base">
                Sign In
              </button>
            </Link>
          </div>

          {/* Live rate ticker */}
          <div className="inline-flex flex-wrap items-center justify-center gap-4 bg-card border border-border/60 rounded-2xl px-6 py-3 shadow-lg">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Live Rate</p>
              <p className="text-sm font-bold text-foreground">1 USDT ≈ <span className="text-primary">3,640</span> UGX</p>
            </div>
            <div className="w-px h-8 bg-border/60" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Networks</p>
              <p className="text-sm font-bold text-foreground">MTN · Airtel</p>
            </div>
            <div className="w-px h-8 bg-border/60" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Avg. Speed</p>
              <p className="text-sm font-bold text-foreground">~<span className="text-primary">2</span> minutes</p>
            </div>
            <div className="w-px h-8 bg-border/60" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Available</p>
              <p className="text-sm font-bold text-primary">24 / 7</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-border/30">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Simple Process</p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">How it works</h2>
          <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">Three simple steps to send money directly to your recipient's mobile wallet.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 relative">
          <div className="hidden sm:block absolute top-8 left-[33%] right-[33%] h-px bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />
          {STEPS.map((s) => (
            <div key={s.step} className="relative bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/30 transition-colors group">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-mono text-3xl font-bold text-primary/20 leading-none mt-1">{s.step}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────────── */}
      <section className="bg-secondary/10 border-y border-border/30 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Why MBIO PAY</p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Built for reliability</h2>
            <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">Every feature designed around a single goal: your money gets there, every time.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card border border-border/50 rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Trusted Senders</p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">What people are saying</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-card border border-border/50 rounded-2xl p-5">
              <div className="flex gap-0.5 mb-3">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-primary text-primary" />)}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.text}"</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.tag}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA Banner ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative bg-primary/10 border border-primary/20 rounded-3xl p-10 sm:p-14 text-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-primary/8 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-3">
              Ready to send your first transfer?
            </h2>
            <p className="text-muted-foreground text-sm mb-7 max-w-md mx-auto">
              Create a free account in 30 seconds. No KYC, no bank account, no waiting.
            </p>
            <Link href="/auth?mode=signup">
              <button className="bg-primary text-primary-foreground font-bold px-8 py-3.5 rounded-2xl hover:bg-primary/90 transition-all hover:scale-105 inline-flex items-center gap-2 text-base shadow-lg shadow-primary/30">
                Create Free Account <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 bg-card/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/images/logo-icon.png" alt="MBIO PAY" className="h-8 w-8 rounded-xl object-cover" />
              <div>
                <div className="flex items-baseline gap-0.5">
                  <span className="font-display text-sm font-bold text-foreground">MBIO</span>
                  <span className="font-display text-sm font-bold text-primary">PAY</span>
                </div>
                <p className="text-[10px] text-muted-foreground">USDT → Uganda Mobile Money</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <a href="tel:+12135105113" className="hover:text-primary transition-colors">+1 213-510-5113</a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground/50">
            <p>© 2026 MBIO PAY. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3" />
              <span>Secured · Encrypted · Monitored 24/7</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
