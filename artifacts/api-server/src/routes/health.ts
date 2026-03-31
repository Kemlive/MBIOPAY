import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { isMongoConnected } from "../lib/mongodb";

const router: IRouter = Router();

const startedAt = new Date();

router.get("/healthz", async (_req, res) => {
  // Probe PostgreSQL with a lightweight query
  let pgStatus: "ok" | "degraded" = "ok";
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
  } catch {
    pgStatus = "degraded";
  }

  const mongoStatus: "ok" | "degraded" | "disabled" = isMongoConnected()
    ? "ok"
    : process.env.MONGODB_URI
      ? "degraded"
      : "disabled";

  const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const overall = pgStatus === "ok" ? "ok" : "degraded";

  const data = HealthCheckResponse.parse({ status: overall });

  res.status(overall === "ok" ? 200 : 503).json({
    ...data,
    version: process.env.npm_package_version ?? "unknown",
    uptime: uptimeSeconds,
    startedAt: startedAt.toISOString(),
    services: {
      postgres: pgStatus,
      mongodb: mongoStatus,
    },
    env: process.env.NODE_ENV ?? "development",
  });
});

export default router;
