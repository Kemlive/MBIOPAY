import { Router } from "express";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
    adminId?: number;
    adminEmail?: string;
  }
}

// ─── Middleware: require admin session ─────────────────────────────────────────
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.isAdmin) {
    res.status(403).json({ error: "Admin session required" });
    return;
  }
  next();
}

// ─── GET /api/admin/setup-totp ─────────────────────────────────────────────────
// Generates a fresh TOTP secret + QR code for admin registration
router.get("/admin/setup-totp", async (_req, res) => {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: "MBIO PAY Admin",
    issuer: "MBIO PAY",
  });

  const qr = await QRCode.toDataURL(secret.otpauth_url!);

  res.json({
    qr,
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
  });
});

// ─── POST /api/admin/register ──────────────────────────────────────────────────
// One-time admin registration (only allowed if no admins exist yet)
router.post("/admin/register", async (req, res) => {
  const { email, password, totpSecret, totpToken } = req.body as {
    email: string;
    password: string;
    totpSecret: string;
    totpToken: string;
  };

  if (!email || !password || !totpSecret || !totpToken) {
    res.status(400).json({ error: "email, password, totpSecret, and totpToken are required" });
    return;
  }

  const existing = await db.select({ id: adminsTable.id }).from(adminsTable).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Admin already registered. Use the login page." });
    return;
  }

  const verified = speakeasy.totp.verify({
    secret: totpSecret,
    encoding: "base32",
    token: totpToken,
    window: 2,
  });

  if (!verified) {
    res.status(422).json({ error: "Invalid TOTP code — make sure your authenticator app is set up correctly" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.insert(adminsTable).values({
    email: email.toLowerCase().trim(),
    passwordHash,
    totpSecret,
  });

  res.status(201).json({ ok: true, message: "Admin account created. You can now log in." });
});

// ─── POST /api/admin/login ─────────────────────────────────────────────────────
router.post("/admin/login", async (req, res) => {
  const { email, password, token, device } = req.body as {
    email: string;
    password: string;
    token: string;
    device: string;
  };

  if (!email || !password || !token) {
    res.status(400).json({ error: "Email, password, and authenticator code are required" });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!admin || !admin.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const passOk = await bcrypt.compare(password, admin.passwordHash);
  if (!passOk) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const verified = speakeasy.totp.verify({
    secret: admin.totpSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!verified) {
    res.status(422).json({ error: "Invalid authenticator code" });
    return;
  }

  if (device) {
    const deviceHash = createHash("sha256").update(device).digest("hex");

    if (admin.deviceHash && admin.deviceHash !== deviceHash) {
      res.status(403).json({ error: "New device detected. Contact support to authorize this device." });
      return;
    }

    if (!admin.deviceHash) {
      await db
        .update(adminsTable)
        .set({ deviceHash, lastLoginAt: new Date() })
        .where(eq(adminsTable.id, admin.id));
    } else {
      await db
        .update(adminsTable)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminsTable.id, admin.id));
    }
  }

  req.session.isAdmin = true;
  req.session.adminId = admin.id;
  req.session.adminEmail = admin.email;

  res.json({ ok: true });
});

// ─── POST /api/admin/logout ────────────────────────────────────────────────────
router.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ─── GET /api/admin/session ────────────────────────────────────────────────────
router.get("/admin/session", (req, res) => {
  if (req.session?.isAdmin) {
    res.json({ authenticated: true, email: req.session.adminEmail });
  } else {
    res.json({ authenticated: false });
  }
});

// ─── POST /api/admin/reset-device ─────────────────────────────────────────────
// Allows admin to clear device binding (requires TOTP verification)
router.post("/admin/reset-device", requireAdmin, async (req, res) => {
  const { token } = req.body as { token: string };

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.adminId!))
    .limit(1);

  if (!admin) { res.status(404).json({ error: "Admin not found" }); return; }

  const verified = speakeasy.totp.verify({
    secret: admin.totpSecret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!verified) {
    res.status(422).json({ error: "Invalid TOTP code" });
    return;
  }

  await db.update(adminsTable).set({ deviceHash: null }).where(eq(adminsTable.id, admin.id));
  res.json({ ok: true, message: "Device binding cleared. Next login will bind the new device." });
});

export default router;
