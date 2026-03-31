import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { visitTracker } from "./routes/tracking";
import { logger } from "./lib/logger";
import { createHash } from "crypto";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "https://accounts.google.com"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", "data:", "https:"],
        connectSrc:  ["'self'", "https://api.mbiopay.com"],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        frameSrc:    ["https://accounts.google.com"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard:     { action: "sameorigin" },
    hsts:           { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

app.use((_req, res, next) => {
  // Allow Google Sign-In popup to communicate back — "same-origin" blocks it
  res.setHeader("Cross-Origin-Opener-Policy",   "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  // Explicit nosniff (belt-and-suspenders on top of helmet)
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Disable sensors not needed by this app
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.get("/.well-known/security.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(
    "Contact: mailto:support@mbiopay.com\n" +
    "Expires: 2027-01-01T00:00:00.000Z\n" +
    "Preferred-Languages: en\n",
  );
});

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Explicit allow-list from environment (comma-separated, highest priority)
  // e.g. ALLOWED_ORIGINS=https://mbiopay.com,https://app.mbiopay.com
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];
  envOrigins.forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) origins.add(trimmed);
  });

  // Replit preview domains (injected automatically by the Replit runtime)
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
  replitDomains.forEach((d) => origins.add(`https://${d.trim()}`));

  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }

  // Production custom domains (kept as safe defaults when ALLOWED_ORIGINS is not set)
  if (!process.env.ALLOWED_ORIGINS) {
    origins.add("https://mbiopay.com");
    origins.add("https://www.mbiopay.com");
    origins.add("https://app.mbiopay.com");
    origins.add("https://admin.mbiopay.com");
    origins.add("https://api.mbiopay.com");
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:5173");
    origins.add("http://localhost:21568");
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-secret"],
  }),
);

app.use(
  session({
    secret: process.env.ADMIN_SECRET ?? "mbio-admin-fallback-secret",
    resave: false,
    saveUninitialized: false,
    name: "mbio_admin_sid",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
    },
  }),
);

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again in a minute." },
  keyGenerator: (req) => {
    const baseIp = ipKeyGenerator(req);
    const ua = req.headers["user-agent"] ?? "";
    return createHash("sha256").update(baseIp + ua).digest("hex");
  },
});

app.use("/api/profile", express.json({ limit: "4mb" }));
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use("/api", globalLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/signup", loginLimiter);
app.use("/api/auth/google", loginLimiter);
app.use("/api/auth/verify-email", loginLimiter);
app.use("/api/auth/resend-verification", loginLimiter);
app.use("/api/auth/forgot-password", loginLimiter);
app.use("/api/auth/reset-password", loginLimiter);

// Visit tracking (MongoDB, non-blocking)
app.use("/api", visitTracker);

app.use("/api", router);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches any unhandled errors thrown by route handlers and returns a safe
// JSON response instead of crashing the process or leaking stack traces.
app.use((err: unknown, req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  // Log with request context when pino-http has attached req.log
  const log = (req as any).log ?? logger;

  if (err instanceof SyntaxError && "body" in err) {
    // express.json() parse error — malformed JSON body
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }

  log.error({ err }, "Unhandled request error");

  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred. Please try again later."
      : (err instanceof Error ? err.message : String(err));

  res.status(typeof status === "number" ? status : 500).json({ error: message });
});

export default app;
export { loginLimiter };
