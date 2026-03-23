import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const { TronWeb } = require("tronweb") as { TronWeb: any };

const USDT_CONTRACT = process.env.USDT_CONTRACT ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const TRC20_ABI = [
  { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "Function" },
];

// Always use public TronGrid — GetBlock URLs don't support wallet/triggerconstantcontract
const TRONGRID_HOST = "https://api.trongrid.io";

function getTronHeaders(): Record<string, string> {
  const t = process.env.TRON_API ?? "";
  if (t && !t.startsWith("http")) return { "TRON-PRO-API-KEY": t };
  return {};
}

function makeTronWeb(): any {
  const opts: Record<string, any> = {
    fullHost: TRONGRID_HOST,
    privateKey: process.env.HOT_PRIVATE_KEY ?? "0000000000000000000000000000000000000000000000000000000000000001",
  };
  const hdrs = getTronHeaders();
  if (Object.keys(hdrs).length > 0) opts.headers = hdrs;
  return new TronWeb(opts);
}

export interface RateResult {
  base: number;
  margin: number;
  finalRate: number;
}

async function getHotWalletBalance(): Promise<number> {
  const hotWallet = process.env.HOT_WALLET;
  if (!hotWallet) return 0;

  try {
    const tw = makeTronWeb();
    const contract = tw.contract(TRC20_ABI, USDT_CONTRACT);
    const raw = await contract.balanceOf(hotWallet).call();
    return parseInt(raw.toString(), 10) / 1e6;
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
