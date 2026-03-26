import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Mail, Lock, User, ArrowRight, ShieldCheck, Phone } from "lucide-react";
import { useLogin, useSignup, useVerify, useGoogleSignIn, useAddPhone, loginSchema, signupSchema, verifySchema } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = "164482455669-9ujlu5kroaqdhms05sacmjbq0aciam06.apps.googleusercontent.com";

type AuthMode = "login" | "signup" | "verify" | "phone";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  // Detect ?step=phone from the URL (set by ProtectedRoute when hasPhone is false)
  const initialMode: AuthMode = (() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("step") === "phone" ? "phone" : "login";
  })();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [emailForVerification, setEmailForVerification] = useState("");
  const [e164Phone, setE164Phone] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const verifyMutation = useVerify();
  const googleSignIn = useGoogleSignIn();
  const addPhone = useAddPhone();

  // After a successful login, go to phone step if user has no phone, else dashboard
  const postLogin = (user: any) => {
    if (!user?.phone) {
      setMode("phone");
    } else {
      setLocation("/");
    }
  };

  // Initialize Google Sign-In button
  useEffect(() => {
    if (mode === "verify" || mode === "phone") return;

    const initGoogle = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            const data = await googleSignIn.mutateAsync(response.credential);
            toast({ title: "Welcome!", description: "Signed in with Google." });
            postLogin(data.user);
          } catch (err: any) {
            toast({ variant: "destructive", title: "Google Sign-In failed", description: err.message });
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_black",
        size: "large",
        width: googleBtnRef.current.offsetWidth || 320,
        text: mode === "signup" ? "signup_with" : "signin_with",
        shape: "rectangular",
      });
    };

    if (!window.google) {
      const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      script?.addEventListener("load", initGoogle);
      return () => script?.removeEventListener("load", initGoogle);
    }
    initGoogle();
    return;
  }, [mode]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" }
  });

  const verifyForm = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { email: "", code: "" }
  });

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    try {
      const result = await loginMutation.mutateAsync(data);
      toast({ title: "Welcome back!", description: "Successfully logged in." });
      postLogin(result.user);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login failed", description: error.message });
    }
  };

  const onSignup = async (data: z.infer<typeof signupSchema>) => {
    try {
      await signupMutation.mutateAsync(data);
      setEmailForVerification(data.email);
      verifyForm.setValue("email", data.email);
      setMode("verify");
      toast({ title: "Account created", description: "Please check your email for the verification code." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Signup failed", description: error.message });
    }
  };

  const onVerify = async (data: z.infer<typeof verifySchema>) => {
    try {
      const result = await verifyMutation.mutateAsync(data);
      toast({ title: "Verified!", description: "Your account is now active." });
      postLogin(result.user);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Verification failed", description: error.message });
    }
  };

  const onAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!e164Phone) {
      toast({ variant: "destructive", title: "Invalid phone number", description: "Please enter a valid phone number including the country code." });
      return;
    }
    try {
      await addPhone.mutateAsync(e164Phone);
      toast({ title: "Phone saved!", description: `${e164Phone} has been linked to your account.` });
      setLocation("/");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to save phone", description: error.message });
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      {/* Auth Container */}
      <div className="w-full max-w-md mx-auto flex flex-col justify-center px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-card border border-white/10 shadow-2xl flex items-center justify-center mx-auto mb-6 glow-primary relative">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse-slow"></div>
            <Activity className="w-8 h-8 text-primary relative z-10" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            Welcome to MBIO<span className="text-primary">PAY</span>
          </h1>
          <p className="text-muted-foreground">The fastest way to remit crypto to Uganda.</p>
        </motion.div>

        <div className="glass-panel rounded-3xl p-8">
          <AnimatePresence mode="wait">
            
            {mode === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div className="space-y-1">
                    <Input 
                      placeholder="Email address" 
                      icon={<Mail className="w-5 h-5" />}
                      {...loginForm.register("email")}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="text-xs text-destructive pl-1">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Input 
                      type="password" 
                      placeholder="Password" 
                      icon={<Lock className="w-5 h-5" />}
                      {...loginForm.register("password")}
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-xs text-destructive pl-1">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <button type="button" className="text-xs text-primary hover:text-primary/80">
                      Forgot password?
                    </button>
                  </div>

                  <Button type="submit" className="w-full mt-6" size="lg" isLoading={loginMutation.isPending}>
                    Sign In <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </form>

                <div className="relative my-6 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-muted-foreground">or continue with</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div ref={googleBtnRef} className="w-full flex justify-center" />

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                    Create one
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "signup" && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                  <div className="space-y-1">
                    <Input 
                      placeholder="Full Name" 
                      icon={<User className="w-5 h-5" />}
                      {...signupForm.register("name")}
                    />
                    {signupForm.formState.errors.name && (
                      <p className="text-xs text-destructive pl-1">{signupForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Input 
                      placeholder="Email address" 
                      icon={<Mail className="w-5 h-5" />}
                      {...signupForm.register("email")}
                    />
                    {signupForm.formState.errors.email && (
                      <p className="text-xs text-destructive pl-1">{signupForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Input 
                      type="password" 
                      placeholder="Create Password" 
                      icon={<Lock className="w-5 h-5" />}
                      {...signupForm.register("password")}
                    />
                    {signupForm.formState.errors.password && (
                      <p className="text-xs text-destructive pl-1">{signupForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full mt-6" size="lg" isLoading={signupMutation.isPending}>
                    Create Account
                  </Button>
                </form>

                <div className="relative my-6 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-muted-foreground">or sign up with</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <div ref={googleBtnRef} className="w-full flex justify-center" />

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                    Sign in
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "verify" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Verify your email</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  We sent a 6-digit code to <span className="text-white">{emailForVerification}</span>
                </p>

                <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-4">
                  <Input 
                    placeholder="Enter 6-digit code" 
                    className="text-center text-2xl tracking-widest font-mono h-14"
                    maxLength={6}
                    {...verifyForm.register("code")}
                  />
                  {verifyForm.formState.errors.code && (
                    <p className="text-xs text-destructive">{verifyForm.formState.errors.code.message}</p>
                  )}

                  <Button type="submit" className="w-full mt-4" size="lg" isLoading={verifyMutation.isPending}>
                    Verify & Continue
                  </Button>
                </form>

                <button onClick={() => setMode("login")} className="mt-6 text-sm text-muted-foreground hover:text-white transition-colors">
                  Back to login
                </button>
              </motion.div>
            )}

            {mode === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Add your mobile number</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Your MTN or Airtel Uganda number for payouts.<br />
                  Format: <span className="text-white font-mono">+256700123456</span>
                </p>

                <form onSubmit={onAddPhone} className="space-y-4">
                  <PhoneInput onChange={setE164Phone} />
                  {e164Phone && (
                    <p className="text-xs text-primary/80 text-center font-mono">{e164Phone}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full mt-4"
                    size="lg"
                    isLoading={addPhone.isPending}
                    disabled={!e164Phone}
                  >
                    Save & Continue <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </form>

                <button
                  onClick={() => setLocation("/")}
                  className="mt-4 text-sm text-muted-foreground hover:text-white transition-colors"
                >
                  Skip for now
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Decorative desktop graphic */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative z-0">
        <div className="absolute inset-0 bg-[url('https://pixabay.com/get/g26c782f5c5b949f73c6822330e17aa1709d0c8c72de68bb1a55da4ed4462f60ba461d5cf17b6dc79134e10647407a68cb16bdb7377ddcd9307ce1b1fe0cd70dc_1280.jpg')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>
        <div className="glass-panel p-12 rounded-[3rem] max-w-lg border border-white/5 relative z-10 shadow-2xl">
          <h2 className="text-4xl font-display font-bold text-white mb-6 leading-tight">
            Remit Crypto to <br/>Mobile Money <span className="text-primary">Instantly.</span>
          </h2>
          <div className="space-y-4">
            {[
              "Best market exchange rates",
              "Instant MTN & Airtel payouts",
              "Zero hidden fees",
              "Secure non-custodial deposits"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-lg text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
