import axios from "axios";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const TRONGRID_BASE = "https://api.trongrid.io";
const USDT_CONTRACT = process.env.USDT_CONTRACT ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export interface RateResult {
  base: number;
  margin: number;
  finalRate: number;
}

async function getHotWalletBalance(): Promise<number> {
  const hotWallet = process.env.HOT_WALLET;
  if (!hotWallet) return 0;

  try {
    const res = await axios.get(`${TRONGRID_BASE}/v1/accounts/${hotWallet}`, {
      headers: { Accept: "application/json" },
      timeout: 8000,
    });

    const trc20: Array<{ key: string; value: string }> = res.data?.data?.[0]?.trc20 ?? [];
    const usdt = trc20.find((t) => t.key === USDT_CONTRACT);
    return usdt ? parseInt(usdt.value, 10) / 1e6 : 0;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch hot wallet balance");
    return 0;
  }
}

async function getPendingDemand(): Promise<number> {
  const rows = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.status, "waiting"));
  return rows.length;
}

export async function getDynamicRate(): Promise<RateResult> {
  const base = parseFloat(process.env.BASE_RATE ?? "3700");
  const minHot = parseFloat(process.env.MIN_HOT_BALANCE ?? "1000");
  const maxHot = parseFloat(process.env.MAX_HOT_BALANCE ?? "5000");

  const [hotBalance, demand] = await Promise.all([
    getHotWalletBalance(),
    getPendingDemand(),
  ]);

  let margin = 0.02;

  if (hotBalance < minHot) margin += 0.02;
  if (demand > 5) margin += 0.01;
  if (hotBalance > maxHot) margin -= 0.01;

  if (margin < 0.01) margin = 0.01;
  if (margin > 0.06) margin = 0.06;

  const finalRate = base * (1 - margin);

  logger.info({ base, margin: (margin * 100).toFixed(1) + "%", finalRate, hotBalance, demand }, "Dynamic rate computed");

  return { base, margin, finalRate };
}

export async function getHotWalletStats() {
  const hotBalance = await getHotWalletBalance();
  const minHot = parseFloat(process.env.MIN_HOT_BALANCE ?? "1000");
  const maxHot = parseFloat(process.env.MAX_HOT_BALANCE ?? "5000");

  return {
    hotBalance,
    minHot,
    maxHot,
    isLow: hotBalance < minHot,
    isHigh: hotBalance > maxHot,
  };
}
