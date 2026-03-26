import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq, and, lt, or } from "drizzle-orm";
import { signAccess, signRefresh } from "../lib/jwt";
import { createHash } from "crypto";
import { logger } from "../lib/logger";

const router = Router();

const GOOGLE_CLIENT_ID =
  process.env["GOOGLE_CLIENT_ID"] ??
  "164482455669-9ujlu5kroaqdhms05sacmjbq0aciam06.apps.googleusercontent.com";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token + (process.env["REFRESH_SECRET"] ?? ""))
    .digest("hex");
}

async function storeRefreshToken(userId: number, token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokensTable).values({ userId, tokenHash, expiresAt });
}

function userPayload(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    usernameSet: user.usernameSet,
    emailVerified: user.emailVerified,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  };
}

/** Generate a unique username from email prefix (e.g. john.doe@... → johndoe_a3f2) */
function generateUsername(email: string): string {
  const base = email.split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6);
  return `${base || "user"}_${suffix}`;
}

// POST /api/auth/google
router.post("/auth/google", async (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Google credential token is required" });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: "Invalid Google token — no email in payload" });
      return;
    }

    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      res.status(400).json({ error: "Google account email is not verified" });
      return;
    }

    const emailLower = email.toLowerCase();

    // Look up by googleId first, fall back to email (merges existing email-only accounts)
    let [user] = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.googleId, googleId!),
          eq(usersTable.email, emailLower),
        ),
      )
      .limit(1);

    if (!user) {
      // Brand-new user — create account
      const uid = randomUUID();
      const randomPass = await bcrypt.hash(randomUUID(), 12); // unguessable — Google-only login
      const username = generateUsername(emailLower);

      const [created] = await db
        .insert(usersTable)
        .values({
          uid,
          email: emailLower,
          username,
          passwordHash: randomPass,
          displayName: name ?? emailLower.split("@")[0],
          avatarUrl: picture ?? null,
          googleId: googleId!,
          emailVerified: true,
          usernameSet: false,
        })
        .returning();
      user = created;
      logger.info({ email: emailLower, uid, googleId }, "New user created via Google Sign-In");
    } else {
      // Existing user — stamp googleId if missing, refresh avatar
      const updates: Partial<typeof usersTable.$inferInsert> = {};
      if (!user.googleId) updates.googleId = googleId!;
      if (picture && user.avatarUrl !== picture) updates.avatarUrl = picture;
      if (!user.emailVerified) updates.emailVerified = true;

      if (Object.keys(updates).length > 0) {
        await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));
        user = { ...user, ...updates };
      }
    }

    if (user.isFrozen) {
      res.status(403).json({ error: "Your account has been suspended. Contact support." });
      return;
    }

    // Issue tokens
    const accessToken = signAccess({ userId: user.id, uid: user.uid });
    const refreshToken = signRefresh({ userId: user.id, uid: user.uid });
    await storeRefreshToken(user.id, refreshToken);

    // Prune expired refresh tokens for this user
    await db
      .delete(refreshTokensTable)
      .where(
        and(
          eq(refreshTokensTable.userId, user.id),
          lt(refreshTokensTable.expiresAt, new Date()),
        ),
      );

    res
      .cookie("mbio_refresh", refreshToken, {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/auth",
      })
      .json({ accessToken, user: userPayload(user) });
  } catch (err: any) {
    logger.error({ err }, "Google Sign-In verification failed");
    if (
      err?.message?.includes("Token used too late") ||
      err?.message?.includes("Invalid token") ||
      err?.message?.includes("wrong number of segments")
    ) {
      res.status(401).json({ error: "Google token is invalid or expired. Please try again." });
    } else {
      res.status(500).json({ error: "Google Sign-In failed. Please try again." });
    }
  }
});

export default router;
