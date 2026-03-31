import { Router, type IRouter } from "express";
import axios from "axios";
import { createHash as _createHash } from "crypto";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth-middleware";
import { getDynamicRate } from "../lib/dynamicRate";
import { createDepositAccount, getFlutterwaveUgxBalance } from "../lib/walletWatcher";
import { runFraudChecks, checkUserFrozen } from "../lib/fraudDetector";
import { logger } from "../lib/logger";

const ORDER_TTL_MINUTES = 30;

const router: IRouter = Router();

const FEE_PERCENT = 0.01;
const MAX_TX_AMOUNT = parseFloat(process.env.MAX_TX_AMOUNT ?? "500");
const MIN_TX_AMOUNT = parseFloat(process.env.MIN_TX_AMOUNT ?? "1");
const TRADE_LIMIT_PER_MIN = parseInt(process.env.TRADE_LIMIT_PER_MIN ?? "10", 10);

const UGANDA_PHONE_RE = /^256\d{9}$/;

const CreateOrderSchema = z.object({
  phone: z
    .string()
    .regex(UGANDA_PHONE_RE, "Invalid phone number. Use format: 256XXXXXXXXX (e.g. 256700000000)"),
  network: z.enum(["MTN", "Airtel"]),
  expectedUsdt: z
    .number()
    .positive("USDT amount must be positive")
    .min(MIN_TX_AMOUNT, `Minimum amount is ${MIN_TX_AMOUNT} USDT`)
    .max(MAX_TX_AMOUNT, `Maximum amount is ${MAX_TX_AMOUNT} USDT`),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

/**
 * Idempotency is enforced at two layers:
 *
 * 1. In-memory map (fast path): catches duplicate requests within the same
 *    process instance within a 10-minute window.
 *
 * 2. DB check (slow path / double-spend guard): queries the orders table for
 *    an existing order with the same user + phone + network + amount created
 *    within the last 30 seconds. This survives process restarts and prevents
 *    double-spending even when the in-memory map is cold.
 */
const recentIdempotencyKeys = new Map<string, number>();

function cleanupOldKeys() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, ts] of recentIdempotencyKeys) {
    if (ts < cutoff) recentIdempotencyKeys.delete(key);
  }
}

function idempotencyKeyHash(userId: number, key: string): string {
  return _createHash("sha256").update(`${userId}:${key}`).digest("hex");
}

async function isDoubleSpend(
  userId: number,
  phone: string,
  network: string,
  amount: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - 30 * 1000); // 30-second dedup window
  const [existing] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, userId),
        eq(ordersTable.phone, phone),
        eq(ordersTable.network, network),
        eq(ordersTable.amount, amount),
        gte(ordersTable.createdAt, windowStart),
      ),
    )
    .limit(1);
  return !!existing;
}

const FLW_NETWORK_CODES: Record<string, string> = { MTN: "MPS", Airtel: "AIN" };

router.get("/resolve-account", requireAuth, async (req, res) => {
  const phone = (req.query.phone as string) ?? "";
  const network = (req.query.network as string) ?? "";

  if (!UGANDA_PHONE_RE.test(phone)) {
    res.status(400).json({ error: "Invalid phone number. Use format: 256XXXXXXXXX" });
    return;
  }

  const bankCode = FLW_NETWORK_CODES[network];
  if (!bankCode) {
    res.status(400).json({ error: "Invalid network. Must be MTN or Airtel" });
    return;
  }

  // Flutterwave test keys only support bank code "044" (Access Bank Nigeria).
  // In test mode, return a mock verified response so the UI flow can be exercised.
  const flwKey = process.env.FLW_SECRET_KEY ?? "";
  if (flwKey.startsWith("FLWSECK_TEST")) {
    const suffix = phone.slice(-4);
    const mockName = network === "MTN"
      ? `MTN SUBSCRIBER ${suffix}`
      : `AIRTEL SUBSCRIBER ${suffix}`;
    res.json({ accountName: mockName, accountNumber: phone, verified: true, network, testMode: true });
    return;
  }

  try {
    const response = await axios.post(
      "https://api.flutterwave.com/v3/accounts/resolve",
      { account_number: phone, account_bank: bankCode },
      {
        headers: {
          Authorization: `Bearer ${flwKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const data = response.data?.data;
    if (!data?.account_name) {
      res.json({ accountName: null, verified: false, network });
      return;
    }

    res.json({
      accountName: data.account_name as string,
      accountNumber: (data.account_number as string) ?? phone,
      verified: true,
      network,
    });
  } catch (err: unknown) {
    logger.warn({ err, phone, network }, "Account name resolve failed — returning unverified");
    res.json({ accountName: null, verified: false, network });
  }
});

router.get("/service-status", async (_req, res) => {
  try {
    const { finalRate } = await getDynamicRate();
    // Service is available as long as rate can be computed.
    // UGX balance is fetched for informational purposes only — never used to gate service.
    const balance = await getFlutterwaveUgxBalance();
    res.json({ available: true, ugxBalance: balance });
  } catch {
    res.json({ available: true });
  }
});

router.get("/quote", async (req, res) => {
  const amount = parseFloat(req.query.amount as string);

  if (isNaN(amount) || amount < MIN_TX_AMOUNT) {
    res.status(400).json({ error: `Minimum amount is ${MIN_TX_AMOUNT} USDT` });
    return;
  }

  if (amount > MAX_TX_AMOUNT) {
    res.status(400).json({ error: `Maximum transaction amount is ${MAX_TX_AMOUNT} USDT` });
    return;
  }

  const { finalRate, base, margin } = await getDynamicRate();
  const fee = amount * FEE_PERCENT;
  const netUsdt = amount - fee;
  const payoutUGX = Math.floor(netUsdt * finalRate);

  res.json({
    usdtAmount: amount,
    payoutUGX,
    usdtRate: finalRate,
    baseRate: base,
    marginPct: parseFloat((margin * 100).toFixed(2)),
    fee: parseFloat(fee.toFixed(6)),
  });
});

router.post("/orders", requireAuth, async (req, res) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { phone, network, expectedUsdt, idempotencyKey } = parsed.data;

  // ── Layer 1: in-memory idempotency key check (fast path) ──────────────────
  if (idempotencyKey) {
    const iKeyHash = idempotencyKeyHash(req.user!.id, idempotencyKey);
    cleanupOldKeys();
    if (recentIdempotencyKeys.has(iKeyHash)) {
      res.status(409).json({ error: "Duplicate request — this order was already submitted" });
      return;
    }
    recentIdempotencyKeys.set(iKeyHash, Date.now());
  }

  // ── Layer 2: DB double-spend guard (survives restarts) ────────────────────
  const doubleSpend = await isDoubleSpend(req.user!.id, phone, network, expectedUsdt);
  if (doubleSpend) {
    res.status(409).json({ error: "A duplicate order for the same phone, network, and amount was submitted within the last 30 seconds. Please wait before retrying." });
    return;
  }

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentOrders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, req.user!.id),
        gte(ordersTable.createdAt, oneMinuteAgo),
      ),
    );

  if (recentOrders.length >= TRADE_LIMIT_PER_MIN) {
    res.status(429).json({
      error: `Order limit reached — max ${TRADE_LIMIT_PER_MIN} orders per minute`,
    });
    return;
  }

  // ── Fraud checks (pre-order) ───────────────────────────────────────────────
  const fraud = await runFraudChecks({
    userId: req.user!.id,
    phone,
    usdtAmount: expectedUsdt,
  });
  if (!fraud.allowed) {
    res.status(403).json({ error: fraud.reason });
    return;
  }

  const { finalRate } = await getDynamicRate();
  const fee = expectedUsdt * FEE_PERCENT;
  const netUsdt = expectedUsdt - fee;
  const payoutUGX = Math.floor(netUsdt * finalRate);

  const flwBalance = await getFlutterwaveUgxBalance();
  // Only block if we have a confirmed balance that is too low.
  // null means the balance API is unreachable — allow through optimistically.
  if (flwBalance !== null && flwBalance < payoutUGX) {
    res.status(503).json({
      error: "Payouts are temporarily unavailable due to insufficient funds. Please try again later.",
    });
    return;
  }

  let depositAddress: string;
  let encryptedPk: string;

  try {
    const account = await createDepositAccount();
    depositAddress = account.address;
    encryptedPk = account.encryptedPk;
  } catch {
    depositAddress = process.env.WALLET_ADDRESS ?? "";
    encryptedPk = "";
  }

  const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000);

  const [order] = await db
    .insert(ordersTable)
    .values({
      phone,
      network,
      status: "waiting",
      userId: req.user!.id,
      amount: expectedUsdt,
      depositAddress,
      encryptedPk,
      expiresAt,
    })
    .returning();

  res.status(201).json({
    orderId: order.id,
    address: depositAddress,
    expectedUsdt,
    payoutUGX,
    rate: finalRate,
    expiresAt: expiresAt.toISOString(),
    message: `Send exactly ${expectedUsdt} USDT (TRC-20) to the address above. Your payout of ${payoutUGX.toLocaleString()} UGX will be sent to ${phone} on ${network}.`,
  });
});

router.get("/orders/mine", requireAuth, async (req, res) => {
  const orders = await db
    .select({
      id: ordersTable.id,
      phone: ordersTable.phone,
      network: ordersTable.network,
      amount: ordersTable.amount,
      ugxAmount: ordersTable.ugxAmount,
      status: ordersTable.status,
      txid: ordersTable.txid,
      depositAddress: ordersTable.depositAddress,
      expiresAt: ordersTable.expiresAt,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, req.user!.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  res.json(orders);
});

router.get("/orders/recent", requireAuth, async (req, res) => {
  const orders = await db
    .select({
      id: ordersTable.id,
      phone: ordersTable.phone,
      network: ordersTable.network,
      amount: ordersTable.amount,
      ugxAmount: ordersTable.ugxAmount,
      status: ordersTable.status,
      txid: ordersTable.txid,
      depositAddress: ordersTable.depositAddress,
      expiresAt: ordersTable.expiresAt,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, req.user!.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(20);

  res.json(orders);
});

router.get("/orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const [order] = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      phone: ordersTable.phone,
      network: ordersTable.network,
      amount: ordersTable.amount,
      ugxAmount: ordersTable.ugxAmount,
      status: ordersTable.status,
      txid: ordersTable.txid,
      depositAddress: ordersTable.depositAddress,
      expiresAt: ordersTable.expiresAt,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.userId !== req.user!.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(order);
});

// ── /transactions aliases ─────────────────────────────────────────────────────
// Expose the same order data under a /transactions namespace for API clarity.

router.get("/transactions", requireAuth, async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 100);
  const offset = Math.max(parseInt((req.query.offset as string) ?? "0", 10), 0);

  const orders = await db
    .select({
      id: ordersTable.id,
      phone: ordersTable.phone,
      network: ordersTable.network,
      amount: ordersTable.amount,
      ugxAmount: ordersTable.ugxAmount,
      status: ordersTable.status,
      txid: ordersTable.txid,
      depositAddress: ordersTable.depositAddress,
      expiresAt: ordersTable.expiresAt,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, req.user!.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ transactions: orders, limit, offset });
});

router.get("/transactions/:txId", requireAuth, async (req, res) => {
  const id = parseInt(req.params.txId ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid transaction ID" });
    return;
  }

  const [order] = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      phone: ordersTable.phone,
      network: ordersTable.network,
      amount: ordersTable.amount,
      ugxAmount: ordersTable.ugxAmount,
      status: ordersTable.status,
      txid: ordersTable.txid,
      depositAddress: ordersTable.depositAddress,
      expiresAt: ordersTable.expiresAt,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, id));

  if (!order) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  if (order.userId !== req.user!.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(order);
});

export default router;
