import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  avatarUrl: z
    .string()
    .max(MAX_AVATAR_BYTES, "Avatar too large (max 2 MB)")
    .optional(),
});

const SetUsernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or less")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores allowed"),
});

router.get("/profile", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    phone: user.phone ?? null,
    hasPhone: !!user.phone,
    usernameSet: user.usernameSet,
    emailVerified: user.emailVerified,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  });
});

router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  res.json({
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    usernameSet: user.usernameSet,
  });
});

router.patch("/profile/username", requireAuth, async (req, res) => {
  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  if (!currentUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (currentUser.usernameSet) {
    res.status(403).json({ error: "Username can only be changed once" });
    return;
  }

  const parsed = SetUsernameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid username" });
    return;
  }

  const { username } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existing.length > 0 && existing[0].id !== currentUser.id) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ username, usernameSet: true, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  res.json({
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    usernameSet: user.usernameSet,
  });
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "Password too long"),
});

router.patch("/profile/password", requireAuth, async (req, res) => {
  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: "New password must be different from current password" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.id));

  await db
    .delete(refreshTokensTable)
    .where(eq(refreshTokensTable.userId, req.user!.id));

  res.json({ success: true, message: "Password updated. Please log in again." });
});

// POST /api/auth/add-phone — save or update phone number for the authenticated user
router.post("/auth/add-phone", requireAuth, async (req, res) => {
  const { phone } = req.body as { phone?: string };

  if (!phone || typeof phone !== "string" || phone.trim().length < 7) {
    res.status(400).json({ error: "A valid phone number is required" });
    return;
  }

  await db
    .update(usersTable)
    .set({ phone: phone.trim() })
    .where(eq(usersTable.id, req.user!.id));

  res.json({ success: true, phone: phone.trim() });
});

// ── /user/profile aliases ─────────────────────────────────────────────────────
// Expose profile data under the /user namespace for REST convention alignment.

router.get("/user/profile", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    phone: user.phone ?? null,
    hasPhone: !!user.phone,
    usernameSet: user.usernameSet,
    emailVerified: user.emailVerified,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  });
});

const UpdateUserProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  avatarUrl: z
    .string()
    .max(MAX_AVATAR_BYTES, "Avatar too large (max 2 MB)")
    .optional(),
  phone: z.string().min(7).max(20).optional(),
});

router.put("/user/profile", requireAuth, async (req, res) => {
  const parsed = UpdateUserProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone.trim();

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  res.json({
    id: user.id,
    uid: user.uid,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    phone: user.phone ?? null,
    usernameSet: user.usernameSet,
  });
});

export default router;
