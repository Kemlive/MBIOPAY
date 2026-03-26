import app from "./app";
import { logger } from "./lib/logger";
import { startWalletWatcher } from "./lib/walletWatcher";
import { connectMongo } from "./lib/mongodb";

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
