import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
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
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const replitDomains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
  replitDomains.forEach((d) => origins.add(`https://${d.trim()}`));

  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
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

app.use("/api", router);

export default app;
export { loginLimiter };
