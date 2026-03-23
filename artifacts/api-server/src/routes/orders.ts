import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth-middleware";
import { getDynamicRate } from "../lib/dynamicRate";
import { createDepositAccount } from "../lib/walletWatcher";

const router: IRouter = Router();

const FEE_PERCENT = 0.01;
const MAX_TX_AMOUNT = parseFloat(process.env.MAX_TX_AMOUNT ?? "500");
const MIN_TX_AMOUNT = 1;
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

const recentIdempotencyKeys = new Map<string, number>();

function cleanupOldKeys() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, ts] of recentIdempotencyKeys) {
    if (ts < cutoff) recentIdempotencyKeys.delete(key);
  }
}

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

  if (idempotencyKey) {
    const iKey = `${req.user!.id}:${idempotencyKey}`;
    cleanupOldKeys();
    if (recentIdempotencyKeys.has(iKey)) {
      res.status(409).json({ error: "Duplicate request — this order was already submitted" });
      return;
    }
    recentIdempotencyKeys.set(iKey, Date.now());
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

  const { finalRate } = await getDynamicRate();
  const fee = expectedUsdt * FEE_PERCENT;
  const netUsdt = expectedUsdt - fee;
  const payoutUGX = Math.floor(netUsdt * finalRate);

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
    })
    .returning();

  res.status(201).json({
    orderId: order.id,
    address: depositAddress,
    expectedUsdt,
    payoutUGX,
    rate: finalRate,
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

export default router;
