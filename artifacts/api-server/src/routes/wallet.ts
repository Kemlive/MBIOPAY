import { Router, type IRouter } from "express";
import axios from "axios";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, sum, count } from "drizzle-orm";

const router: IRouter = Router();

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_BASE = "https://api.trongrid.io";
const UGX_RATE = 3700;

async function fetchUsdtBalance(address: string): Promise<number> {
  try {
    const res = await axios.get(`${TRONGRID_BASE}/v1/accounts/${address}`, {
      headers: { Accept: "application/json" },
      timeout: 10000,
    });

    const trc20Balances: Array<{ [contract: string]: string }> =
      res.data?.data?.[0]?.trc20 ?? [];

    for (const entry of trc20Balances) {
      if (entry[USDT_CONTRACT]) {
        return parseInt(entry[USDT_CONTRACT], 10) / 1e6;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

router.get("/wallet/address", (_req, res) => {
  res.json({
    address: process.env.WALLET_ADDRESS ?? "",
    network: "TRC-20 (TRON)",
  });
});

router.get("/wallet/balance", async (req, res) => {
  const address = process.env.WALLET_ADDRESS ?? "";
  const usdtBalance = await fetchUsdtBalance(address);
  const ugxEquivalent = Math.floor(usdtBalance * UGX_RATE);

  req.log.info({ address, usdtBalance }, "Wallet balance fetched");

  res.json({
    usdtBalance,
    ugxEquivalent,
    usdtRate: UGX_RATE,
    address,
  });
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

  res.json({
    totalOrders: totals?.totalOrders ?? 0,
    completedOrders: completed?.completedOrders ?? 0,
    totalUgxPaidOut: Number(completed?.totalUgxPaidOut ?? 0),
    totalUsdtReceived: Number(completed?.totalUsdtReceived ?? 0),
    pendingOrders: pending?.pendingOrders ?? 0,
  });
});

export default router;
