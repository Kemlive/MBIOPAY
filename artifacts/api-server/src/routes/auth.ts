import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID, createHash } from "crypto";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt";
import { requireAuth } from "../lib/auth-middleware";

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
    .max(128, "Password too long"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token + (process.env.REFRESH_SECRET ?? ""))
    .digest("hex");
}

function userPayload(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    usernameSet: user.usernameSet,
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
    .where(
      and(
        eq(refreshTokensTable.userId, userId),
        lt(refreshTokensTable.expiresAt, new Date()),
      ),
    );
}

router.post("/auth/signup", async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, username, password } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const usernameExists = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (usernameExists.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const uid = randomUUID().slice(0, 8).toUpperCase();

  const [user] = await db
    .insert(usersTable)
    .values({ email: email.toLowerCase(), username, passwordHash, uid })
    .returning();

  const accessToken = signAccess({ id: user.id });
  const refreshToken = signRefresh({ id: user.id });
  await storeRefreshToken(user.id, refreshToken);

  res.status(201).json({
    accessToken,
    refreshToken,
    user: userPayload(user),
  });
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const { email, password } = parsed.data;

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

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const newAttempts = user.failedAttempts + 1;
    const locked = newAttempts >= MAX_FAILED_ATTEMPTS;

    await db
      .update(usersTable)
      .set({
        failedAttempts: newAttempts,
        lockedUntil: locked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        updatedAt: new Date(),
      })
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

  await db
    .update(usersTable)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await cleanupExpiredTokens(user.id);

  const accessToken = signAccess({ id: user.id });
  const refreshToken = signRefresh({ id: user.id });
  await storeRefreshToken(user.id, refreshToken);

  res.json({
    accessToken,
    refreshToken,
    user: userPayload(user),
  });
});

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
      .where(
        and(
          eq(refreshTokensTable.tokenHash, tokenHash),
          eq(refreshTokensTable.userId, payload.id),
          gt(refreshTokensTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      res.status(401).json({ error: "Invalid or revoked refresh token" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.id))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    await revokeRefreshToken(refreshToken);

    const newAccessToken = signAccess({ id: user.id });
    const newRefreshToken = signRefresh({ id: user.id });
    await storeRefreshToken(user.id, newRefreshToken);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken && typeof refreshToken === "string") {
    await revokeRefreshToken(refreshToken).catch(() => {});
  }

  await db
    .delete(refreshTokensTable)
    .where(eq(refreshTokensTable.userId, req.user!.id))
    .catch(() => {});

  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(userPayload(user));
});

export default router;
