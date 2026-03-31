import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID, createHash } from "crypto";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt";
import { requireAuth } from "../lib/auth-middleware";
import { isDisposableEmail } from "../lib/disposableEmails";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/emailService";
import { sendOTP, verifyOTP, isIPBlocked } from "../lib/otpService";
import speakeasy from "speakeasy";

const VERIFY_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generateVerifyCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const router = Router();

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const SignupSchema = z.object({
  email: z.string().email("Valid email required"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or less")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
  totpToken: z.string().optional(),
});

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token + (process.env.REFRESH_SECRET ?? ""))
    .digest("hex");
}

function getClientIP(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function userPayload(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    phone: user.phone ?? null,
    usernameSet: user.usernameSet,
    emailVerified: user.emailVerified,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  };
}

async function storeRefreshToken(userId: number, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokensTable).values({ userId, tokenHash, expiresAt });
}

async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.tokenHash, tokenHash));
}

async function cleanupExpiredTokens(userId: number): Promise<void> {
  await db
    .delete(refreshTokensTable)
    .where(and(eq(refreshTokensTable.userId, userId), lt(refreshTokensTable.expiresAt, new Date())));
}

// ─── POST /api/auth/signup ──────────────────────────────────────────────────
router.post("/auth/signup", async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, username, password } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  if (isDisposableEmail(emailLower)) {
    res.status(400).json({ error: "Disposable or temporary email addresses are not allowed. Please use a permanent email." });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id, emailVerified: usersTable.emailVerified })
    .from(usersTable)
    .where(eq(usersTable.email, emailLower))
    .limit(1);

  if (existing.length > 0) {
    if (!existing[0].emailVerified) {
      await sendOTP(emailLower, getClientIP(req)).catch(() => {});
      res.status(200).json({ requiresVerification: true, email: emailLower, message: "A new verification code has been sent to your email." });
      return;
    }
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const usernameExists = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (usernameExists.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const uid = randomUUID().slice(0, 8).toUpperCase();

  await db.insert(usersTable).values({
    email: emailLower,
    username,
    passwordHash,
    uid,
    emailVerified: false,
  });

  await sendOTP(emailLower, getClientIP(req)).catch(() => {});

  res.status(201).json({ requiresVerification: true, email: emailLower });
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
router.post("/auth/verify-email", async (req, res) => {
  const { email, code } = req.body as { email: string; code: string };

  if (!email || !code) {
    res.status(400).json({ error: "Email and code are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  if (user.emailVerified) {
    res.status(400).json({ error: "Email is already verified" });
    return;
  }

  try {
    await verifyOTP(user.email, code, getClientIP(req));
  } catch (err: any) {
    res.status(err.status ?? 422).json({ error: err.message ?? "Invalid verification code." });
    return;
  }

  await db.update(usersTable)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  const accessToken = signAccess({ id: user.id });
  const refreshToken = signRefresh({ id: user.id });
  await storeRefreshToken(user.id, refreshToken);

  res.json({
    token: accessToken,
    refreshToken,
    user: userPayload({ ...user, emailVerified: true, emailVerifyCode: null, emailVerifyExpires: null }),
  });
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
router.post("/auth/resend-verification", async (req, res) => {
  const { email } = req.body as { email: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    res.status(200).json({ ok: true });
    return;
  }

  if (user.emailVerified) {
    res.status(400).json({ error: "Email is already verified" });
    return;
  }

  try {
    await sendOTP(user.email, getClientIP(req));
  } catch (err: any) {
    res.status(err.status ?? 429).json({ error: err.message ?? "Failed to send code." });
    return;
  }

  res.json({ ok: true });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const { email, password, totpToken } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    res.status(423).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? "s" : ""}.`,
    });
    return;
  }

  if (user.isFrozen) {
    res.status(403).json({
      error: `Your account has been suspended. ${user.frozenReason ?? "Please contact support."}`,
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const newAttempts = user.failedAttempts + 1;
    const locked = newAttempts >= MAX_FAILED_ATTEMPTS;
    await db.update(usersTable)
      .set({ failedAttempts: newAttempts, lockedUntil: locked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    if (locked) {
      res.status(423).json({ error: "Too many failed attempts. Account locked for 15 minutes." });
    } else {
      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      res.status(401).json({
        error: `Invalid email or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      });
    }
    return;
  }

  if (!user.emailVerified) {
    const code = generateVerifyCode();
    const expires = new Date(Date.now() + VERIFY_CODE_TTL_MS);
    await db.update(usersTable)
      .set({ emailVerifyCode: code, emailVerifyExpires: expires, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    await sendVerificationEmail(user.email, code).catch(() => {});
    res.status(403).json({ requiresVerification: true, email: user.email, error: "Please verify your email before signing in. A new code has been sent." });
    return;
  }

  if (user.totpEnabled && user.totpSecret) {
    if (!totpToken) {
      res.status(200).json({ requiresTOTP: true, email: user.email });
      return;
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: "base32",
      token: totpToken,
      window: 1,
    });

    if (!verified) {
      res.status(422).json({ error: "Invalid authenticator code. Please try again." });
      return;
    }
  }

  await db.update(usersTable)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await cleanupExpiredTokens(user.id);

  const accessToken = signAccess({ id: user.id });
  const refreshToken = signRefresh({ id: user.id });
  await storeRefreshToken(user.id, refreshToken);

  res.json({ token: accessToken, refreshToken, user: userPayload(user) });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }

  try {
    const payload = verifyRefresh(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const [stored] = await db
      .select()
      .from(refreshTokensTable)
      .where(and(eq(refreshTokensTable.tokenHash, tokenHash), eq(refreshTokensTable.userId, payload.id), gt(refreshTokensTable.expiresAt, new Date())))
      .limit(1);

    if (!stored) {
      res.status(401).json({ error: "Invalid or revoked refresh token" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.id)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    await revokeRefreshToken(refreshToken);
    const newAccessToken = signAccess({ id: user.id });
    const newRefreshToken = signRefresh({ id: user.id });
    await storeRefreshToken(user.id, newRefreshToken);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email: string };
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const emailLower = email.toLowerCase().trim();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailLower)).limit(1);

  // Always return success to prevent user enumeration
  if (!user || !user.emailVerified) {
    res.json({ ok: true });
    return;
  }

  const token = randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.update(usersTable)
    .set({ passwordResetToken: token, passwordResetExpires: expires, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await sendPasswordResetEmail(emailLower, token).catch(() => {});

  res.json({ ok: true });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

router.post("/auth/reset-password", async (req, res) => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid request";
    res.status(400).json({ error: msg });
    return;
  }

  const { token, password } = parsed.data;

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.passwordResetToken, token))
    .limit(1);

  if (!user || !user.passwordResetExpires) {
    res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
    return;
  }

  if (user.passwordResetExpires < new Date()) {
    res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.update(usersTable)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpires: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  // Revoke all existing sessions
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, user.id)).catch(() => {});

  res.json({ ok: true });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", requireAuth, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === "string") {
    await revokeRefreshToken(refreshToken).catch(() => {});
  }
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, req.user!.id)).catch(() => {});
  res.json({ success: true });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(userPayload(user));
});

export default router;
