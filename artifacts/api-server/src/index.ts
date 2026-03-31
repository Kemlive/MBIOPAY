import app from "./app";
import { logger } from "./lib/logger";
import { startWalletWatcher } from "./lib/walletWatcher";
import { connectMongo } from "./lib/mongodb";

// ── Required environment variable validation ──────────────────────────────────
// Fail fast at startup rather than crashing mid-request with a cryptic error.
const REQUIRED_ENV_VARS: Array<{ name: string; hint: string }> = [
  { name: "DATABASE_URL",    hint: "PostgreSQL connection string" },
  { name: "JWT_SECRET",      hint: "Secret used to sign access tokens (min 32 chars recommended)" },
  { name: "REFRESH_SECRET",  hint: "Secret used to sign refresh tokens (min 32 chars recommended)" },
  { name: "ENCRYPTION_KEY",  hint: "AES-256 key for encrypting wallet private keys" },
];

if (process.env.NODE_ENV === "production") {
  const missing = REQUIRED_ENV_VARS.filter(({ name }) => !process.env[name]);
  if (missing.length > 0) {
    for (const { name, hint } of missing) {
      console.error(`[startup] Missing required env var: ${name} — ${hint}`);
    }
    process.exit(1);
  }

  // Warn about weak secrets (too short to be safe)
  for (const name of ["JWT_SECRET", "REFRESH_SECRET", "ENCRYPTION_KEY"]) {
    const val = process.env[name] ?? "";
    if (val.length < 32) {
      console.warn(`[startup] WARNING: ${name} is shorter than 32 characters — use a longer, random secret in production`);
    }
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Connect to MongoDB (non-blocking — app starts regardless)
connectMongo().catch(() => {});

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startWalletWatcher();
});

// ── Graceful shutdown — ensures port is released immediately on SIGTERM ────────
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully…");
  server.close(() => {
    logger.info("All connections closed. Exiting.");
    process.exit(0);
  });

  // Force-kill if connections hang beyond 5s
  setTimeout(() => {
    logger.warn("Forced exit after 5s shutdown timeout");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
