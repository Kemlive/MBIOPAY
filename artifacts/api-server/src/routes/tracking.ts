import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import { isMongoConnected } from "../lib/mongodb";
import { Visit, Lead, Referral } from "../lib/mongoModels";
import { logger } from "../lib/logger";
import { requireAdmin } from "./adminAuth";

const router: IRouter = Router();

/* ── Geo helper (lazy, won't crash if data files missing) ────────────────── */
let _geoipLookup: ((ip: string) => { country?: string } | null) | null = null;

async function initGeoip(): Promise<void> {
  try {
    // Point geoip-lite at its own bundled data directory
    const _dir = path.dirname(fileURLToPath(import.meta.url));
    // In dev: dist/routes → node_modules; in prod same relative path applies
    const candidates = [
      path.resolve(_dir, "../../node_modules/geoip-lite/data"),
      path.resolve(_dir, "../../../node_modules/geoip-lite/data"),
      path.resolve(process.cwd(), "node_modules/geoip-lite/data"),
      // pnpm workspace root
      "/home/runner/workspace/node_modules/.pnpm/geoip-lite@2.0.1/node_modules/geoip-lite/data",
    ];
    for (const p of candidates) {
      try {
        const { existsSync } = await import("fs");
        if (existsSync(path.join(p, "geoip-country.dat"))) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (global as any).geodatadir = p;
          process.env["GEODATADIR"] = p;
          break;
        }
      } catch { /* continue */ }
    }

    const mod = await import("geoip-lite");
    const geoip = (mod.default ?? mod) as { lookup: (ip: string) => { country?: string } | null };
    _geoipLookup = (ip) => {
      try { return geoip.lookup(ip); } catch { return null; }
    };
    logger.info("geoip-lite loaded");
  } catch (err) {
    logger.warn({ err }, "geoip-lite unavailable — country tracking disabled");
  }
}

// Fire-and-forget on module load
initGeoip().catch(() => {});

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

function getCountry(ip: string): string {
  if (!_geoipLookup) return "unknown";
  try {
    return _geoipLookup(ip)?.country ?? "unknown";
  } catch {
    return "unknown";
  }
}

/* ── Visit tracking middleware (fire-and-forget, non-blocking) ───────────── */
export function visitTracker(req: Request, _res: Response, next: NextFunction): void {
  if (!isMongoConnected()) { next(); return; }

  const url = req.url;
  // Skip healthz and static-like paths
  if (url.startsWith("/healthz") || url.includes(".") || url.startsWith("/__")) {
    next();
    return;
  }

  const ip = getClientIp(req);
  const country = getCountry(ip);
  const ref = (req.query["ref"] as string | undefined) ?? null;
  const userAgent = req.headers["user-agent"] ?? "";

  Visit.create({ url, ip, country, ref, userAgent, time: new Date() }).catch(() => {});

  if (ref) {
    Referral.findOneAndUpdate(
      { refId: ref },
      { $inc: { clicks: 1 } },
      { upsert: false }
    ).catch(() => {});
  }

  next();
}

/* ── Lead capture ────────────────────────────────────────────────────────── */
const LeadSchema = z.object({
  email: z.string().email().max(254),
});

router.post("/lead", async (req: Request, res: Response) => {
  const parsed = LeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const ref   = (req.query["ref"] as string | undefined) ?? null;
  const ip     = getClientIp(req);
  const country = getCountry(ip);

  if (!isMongoConnected()) {
    logger.info({ email }, "Lead captured (MongoDB unavailable)");
    res.json({ ok: true });
    return;
  }

  try {
    await Lead.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, ref, ip, country, time: new Date() } },
      { upsert: true, new: false }
    );

    if (ref) {
      await Referral.findOneAndUpdate(
        { refId: ref },
        { $inc: { conversions: 1 } },
        { upsert: false }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Lead save error");
    res.json({ ok: true });
  }
});

/* ── Referral: create ────────────────────────────────────────────────────── */
router.post("/referral/create", requireAdmin, async (_req: Request, res: Response) => {
  if (!isMongoConnected()) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  const refId = uuidv4();
  await Referral.create({ refId, clicks: 0, conversions: 0 });

  res.json({
    refId,
    link: `https://mbiopay.com/?ref=${refId}`,
  });
});

/* ── Referral: list ──────────────────────────────────────────────────────── */
router.get("/referral/list", requireAdmin, async (_req: Request, res: Response) => {
  if (!isMongoConnected()) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  const refs = await Referral.find().sort({ clicks: -1 }).lean();
  res.json(refs);
});

/* ── Analytics dashboard ─────────────────────────────────────────────────── */
router.get("/admin/mongo-analytics", requireAdmin, async (_req: Request, res: Response) => {
  if (!isMongoConnected()) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  try {
    const [totalVisits, totalLeads, countriesRaw, topPagesRaw, refs] = await Promise.all([
      Visit.countDocuments(),
      Lead.countDocuments(),
      Visit.aggregate([
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      Visit.aggregate([
        { $group: { _id: "$url", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Referral.find().sort({ clicks: -1 }).lean(),
    ]);

    res.json({
      totalVisits,
      totalLeads,
      conversionRate: totalVisits > 0 ? (totalLeads / totalVisits).toFixed(4) : "0",
      topCountries: countriesRaw.map((c) => ({ country: c._id, visits: c.count })),
      topPages: topPagesRaw.map((p) => ({ url: p._id, visits: p.count })),
      referrals: refs,
    });
  } catch (err) {
    logger.error({ err }, "Analytics query error");
    res.status(500).json({ error: "Analytics query failed" });
  }
});

export default router;
