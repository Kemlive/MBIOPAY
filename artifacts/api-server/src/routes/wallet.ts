import { Router, type IRouter } from "express";
import axios from "axios";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, sum, count } from "drizzle-orm";
import { getDynamicRate, getHotWalletStats } from "../lib/dynamicRate";

const router: IRouter = Router();

const USDT_CONTRACT = process.env.USDT_CONTRACT ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_BASE = "https://api.trongrid.io";

async function fetchUsdtBalance(address: string): Promise<number> {
  try {
    const res = await axios.get(`${TRONGRID_BASE}/v1/accounts/${address}`, {
      headers: { Accept: "application/json" },
      timeout: 10000,
    });

    const trc20: Array<{ key: string; value: string }> = res.data?.data?.[0]?.trc20 ?? [];
    const usdt = trc20.find((t) => t.key === USDT_CONTRACT);
    return usdt ? parseInt(usdt.value, 10) / 1e6 : 0;
  } catch {
    return 0;
  }
}

router.get("/wallet/address", (_req, res) => {
  res.json({
    address: process.env.HOT_WALLET ?? process.env.WALLET_ADDRESS ?? "",
    network: "TRC-20 (TRON)",
  });
});

router.get("/wallet/balance", async (req, res) => {
  const address = process.env.HOT_WALLET ?? process.env.WALLET_ADDRESS ?? "";
  const [usdtBalance, rateData] = await Promise.all([
    fetchUsdtBalance(address),
    getDynamicRate(),
  ]);
  const ugxEquivalent = Math.floor(usdtBalance * rateData.finalRate);

  req.log.info({ address, usdtBalance, rate: rateData.finalRate }, "Wallet balance fetched");

  res.json({
    usdtBalance,
    ugxEquivalent,
    usdtRate: rateData.finalRate,
    baseRate: rateData.base,
    marginPct: parseFloat((rateData.margin * 100).toFixed(2)),
    address,
  });
});

router.get("/wallet/hot-stats", async (_req, res) => {
  const stats = await getHotWalletStats();
  res.json(stats);
});

router.get("/stats", async (_req, res) => {
  const [totals] = await db
    .select({
      totalOrders: count(ordersTable.id),
    })
    .from(ordersTable);

  const [completed] = await db
    .select({
      completedOrders: count(ordersTable.id),
      totalUgxPaidOut: sum(ordersTable.ugxAmount),
      totalUsdtReceived: sum(ordersTable.amount),
    })
    .from(ordersTable)
    .where(eq(ordersTable.status, "completed"));

  const [pending] = await db
    .select({ pendingOrders: count(ordersTable.id) })
    .from(ordersTable)
    .where(eq(ordersTable.status, "waiting"));

  const rateData = await getDynamicRate();

  res.json({
    totalOrders: totals?.totalOrders ?? 0,
    completedOrders: completed?.completedOrders ?? 0,
    totalUgxPaidOut: Number(completed?.totalUgxPaidOut ?? 0),
    totalUsdtReceived: Number(completed?.totalUsdtReceived ?? 0),
    pendingOrders: pending?.pendingOrders ?? 0,
    currentRate: rateData.finalRate,
    marginPct: parseFloat((rateData.margin * 100).toFixed(2)),
  });
});

export default router;
