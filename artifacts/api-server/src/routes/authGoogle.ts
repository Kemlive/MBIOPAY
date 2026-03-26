import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
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
    usernameSet: user.usernameSet,
    emailVerified: user.emailVerified,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  };
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

    const { email, name, picture, email_verified } = payload;

    if (!email_verified) {
      res.status(400).json({ error: "Google account email is not verified" });
      return;
    }

    // Find or create the user
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      // New user — create account (no password, Google-only sign-in)
      const uid = randomUUID();
      const randomPass = await bcrypt.hash(randomUUID(), 12); // unguessable, login only via Google
      const [created] = await db
        .insert(usersTable)
        .values({
          uid,
          email: email.toLowerCase(),
          passwordHash: randomPass,
          displayName: name ?? email.split("@")[0],
          avatarUrl: picture ?? null,
          emailVerified: true,
          usernameSet: false,
        })
        .returning();
      user = created;
      logger.info({ email, uid }, "New user created via Google Sign-In");
    } else {
      // Existing user — update avatar/name if changed from Google
      if (picture && user.avatarUrl !== picture) {
        await db
          .update(usersTable)
          .set({ avatarUrl: picture, emailVerified: true })
          .where(eq(usersTable.id, user.id));
        user = { ...user, avatarUrl: picture, emailVerified: true };
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

    // Clean up expired tokens
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
    if (err?.message?.includes("Token used too late") || err?.message?.includes("Invalid token")) {
      res.status(401).json({ error: "Google token is invalid or expired. Please try again." });
    } else {
      res.status(500).json({ error: "Google Sign-In failed. Please try again." });
    }
  }
});

export default router;
