import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const UGX_RATE = 3700;
const FEE_PERCENT = 0.01; // 1% fee

const CreateOrderSchema = z.object({
  phone: z.string().min(5, "Phone number is required"),
  network: z.enum(["MTN", "Airtel"]),
  expectedUsdt: z.number().positive("USDT amount must be positive"),
});

router.get("/quote", (req, res) => {
  const amount = parseFloat(req.query.amount as string);

  if (isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const fee = amount * FEE_PERCENT;
  const netUsdt = amount - fee;
  const payoutUGX = Math.floor(netUsdt * UGX_RATE);

  res.json({
    usdtAmount: amount,
    payoutUGX,
    usdtRate: UGX_RATE,
    fee: parseFloat(fee.toFixed(6)),
  });
});

router.post("/orders", async (req, res) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { phone, network, expectedUsdt } = parsed.data;
  const fee = expectedUsdt * FEE_PERCENT;
  const netUsdt = expectedUsdt - fee;
  const payoutUGX = Math.floor(netUsdt * UGX_RATE);

  const [order] = await db
    .insert(ordersTable)
    .values({ phone, network, status: "waiting" })
    .returning();

  res.status(201).json({
    orderId: order.id,
    address: process.env.WALLET_ADDRESS,
    message: `Send exactly ${expectedUsdt} USDT (TRC-20) to the address above. Your payout of ${payoutUGX.toLocaleString()} UGX will be sent to ${phone} on ${network}.`,
    payoutUGX,
  });
});

router.get("/orders/recent", async (_req, res) => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(20);

  res.json(orders);
});

router.get("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

export default router;
