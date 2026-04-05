import axios from "axios";
import { db } from "@workspace/db";
import { ordersTable, orderAuditLogTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";
import { encrypt, decrypt } from "./encryption";
import { getDynamicRate } from "./dynamicRate";
import TronWeb from "tronweb";

// ── Telegram alert helper ─────────────────────────────────────────────────────
async function sendTelegramAlert(text: string): Promise<void> {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text, parse_mode: "HTML" },
      { timeout: 8000 },
    );
  } catch (err) {
    logger.warn({ err }, "Telegram alert failed to send");
  }
}

const USDT_CONTRACT = process.env.USDT_CONTRACT ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// Minimal TRC-20 ABI — avoids calling wallet/getcontract on the node
const TRC20_ABI = [
  { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "Function" },
  { constant: false, inputs: [{ name: "_to", type: "address" }, { name: "_value", type: "uint256" }], name: "transfer", outputs: [{ name: "", type: "bool" }], type: "Function" },
];

function getUsdtContract(tw: any) {
  return tw.contract(TRC20_ABI, USDT_CONTRACT);
}

// Always use TronGrid — the public endpoint has generous limits for monitoring.
// If TRON_API is a bare UUID/key (not a URL), pass it as the TronGrid API key header.
const TRONGRID_HOST = "https://api.trongrid.io";

function getTronHeaders(): Record<string, string> {
  const t = process.env.TRON_API ?? "";
  // Only use as a header key if it looks like a UUID/token, not a URL
  if (t && !t.startsWith("http")) return { "TRON-PRO-API-KEY": t };
  return {};
}

// =====================
// 🏦 TRON ACCOUNT
// =====================

function getTronWeb(privateKey?: string): any {
  const opts: Record<string, any> = {
    fullHost: TRONGRID_HOST,
    privateKey: privateKey ?? process.env.HOT_PRIVATE_KEY ?? "",
  };
  const hdrs = getTronHeaders();
  if (Object.keys(hdrs).length > 0) opts.headers = hdrs;
  return new TronWeb(opts);
}

export async function createDepositAccount(): Promise<{ address: string; encryptedPk: string }> {
  const tw = getTronWeb();
  const account = await tw.createAccount();
  const address: string = account.address.base58;
  const encryptedPk = encrypt(account.privateKey);
  return { address, encryptedPk };
}

// =====================
// 💰 FLUTTERWAVE BALANCE
// =====================

let cachedFlwBalance: { ugx: number; fetchedAt: number } | null = null;
const FLW_BALANCE_TTL_MS = 30_000;

export async function getFlutterwaveUgxBalance(): Promise<number | null> {
  if (cachedFlwBalance && Date.now() - cachedFlwBalance.fetchedAt < FLW_BALANCE_TTL_MS) {
    return cachedFlwBalance.ugx;
  }
  try {
    const res = await axios.get("https://api.flutterwave.com/v3/balances/UGX", {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      timeout: 8000,
    });
    const ugx: number = res.data?.data?.available_balance ?? 0;
    cachedFlwBalance = { ugx, fetchedAt: Date.now() };
    return ugx;
  } catch (err) {
    logger.warn({ err }, "Could not fetch Flutterwave balance");
    // Return cached value if available, otherwise null (unknown — do NOT assume zero)
    return cachedFlwBalance?.ugx ?? null;
  }
}

export function invalidateFlwBalanceCache() {
  cachedFlwBalance = null;
}

// =====================
// 💳 FLUTTERWAVE PAYOUT
// =====================

async function executePayout(orderId: number, phone: string, network: string, amount: number): Promise<void> {
  const { finalRate } = await getDynamicRate();
  const ugx = Math.floor(amount * finalRate);
  const flwNetwork = network === "MTN" ? "MPS" : "AIN";

  try {
    const response = await axios.post(
      "https://api.flutterwave.com/v3/transfers",
      {
        account_bank: flwNetwork,
        account_number: phone,
        amount: ugx,
        currency: "UGX",
        narration: "MBIO PAY Remittance",
        reference: `mbio-${orderId}-${Date.now()}`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    logger.info({ orderId, flwStatus: response.data?.status, ugx, rate: finalRate }, "Flutterwave payout sent");

    await sendTelegramAlert(
      `✅ <b>MBIOPAY PAYOUT SENT</b>\nOrder: <code>${orderId}</code>\nAmount: <code>${ugx.toLocaleString()} UGX</code>\nNetwork: <code>${network}</code>`,
    );

    await db
      .update(ordersTable)
      .set({ status: "completed", ugxAmount: ugx, updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    await db.insert(orderAuditLogTable).values({
      orderId,
      fromStatus: "processing",
      toStatus: "completed",
      triggeredBy: "watcher",
      meta: { ugx, rate: finalRate, flwStatus: response.data?.status },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const responseData = axios.isAxiosError(err) ? err.response?.data : undefined;
    logger.error({ orderId, error: message, responseData }, "Flutterwave payout failed");

    await sendTelegramAlert(
      `⚠️ <b>MBIOPAY PAYOUT FAILED</b>\nOrder: <code>${orderId}</code>\nError: ${message}`,
    );

    await db
      .update(ordersTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    await db.insert(orderAuditLogTable).values({
      orderId,
      fromStatus: "processing",
      toStatus: "failed",
      triggeredBy: "watcher",
      meta: { error: message, responseData },
    });
  }
}

// =====================
// 🔁 RETRY HELPER
// =====================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 30000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * attempt;
        logger.warn({ attempt, delay, err }, "Retrying after error");
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// =====================
// 🔁 SWEEP
// =====================

async function sweep(order: typeof ordersTable.$inferSelect, amount: number): Promise<void> {
  const hotWallet = process.env.HOT_WALLET;
  if (!hotWallet || !order.encryptedPk) return;

  try {
    await withRetry(async () => {
      const pk = decrypt(order.encryptedPk!);
      const tw = getTronWeb(pk);
      const contract = getUsdtContract(tw);
      await contract.transfer(hotWallet, Math.floor(amount * 1e6)).send();
    });
    logger.info({ orderId: order.id, amount }, "Swept to hot wallet");
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Sweep failed after 3 attempts — manual recovery needed");
  }
}

// =====================
// 🔍 WATCHER — Per-order address polling
// =====================

let watching = false;

async function watchOrders(): Promise<void> {
  if (watching) return;
  watching = true;

  try {
    const tw = getTronWeb();

    const waitingOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "waiting"));

    for (const order of waitingOrders) {
      if (!order.depositAddress) continue;

      try {
        // Use balanceOf to check confirmed USDT balance on the deposit address.
        // This works with any TRON node (TronGrid, GetBlock, etc.) without REST-only endpoints.
        const contract = getUsdtContract(tw);
        const rawBalance = await contract.balanceOf(order.depositAddress).call();
        const received = parseInt(rawBalance.toString(), 10) / 1e6;

        if (!order.amount || received < order.amount - 0.5) continue;

        const txid = `balance-confirmed-${order.id}-${Date.now()}`;

        await db
          .update(ordersTable)
          .set({ status: "processing", txid, updatedAt: new Date() })
          .where(eq(ordersTable.id, order.id));

        logger.info({ orderId: order.id, received, expected: order.amount }, "Deposit confirmed via balanceOf");

        await sweep(order, received);
        await executePayout(order.id, order.phone, order.network, received);
      } catch (err) {
        logger.warn({ err, address: order.depositAddress }, "Error checking deposit address");
      }
    }
  } catch (err) {
    logger.error({ err }, "Watcher loop error");
  } finally {
    watching = false;
  }
}

// =====================
// ⚖️ REBALANCE (hot → cold)
// =====================

async function rebalance(): Promise<void> {
  const hotWallet = process.env.HOT_WALLET;
  const coldWallet = process.env.COLD_WALLET;
  const hotPk = process.env.HOT_PRIVATE_KEY;
  const maxHot = parseFloat(process.env.MAX_HOT_BALANCE ?? "5000");
  const minHot = parseFloat(process.env.MIN_HOT_BALANCE ?? "1000");

  if (!hotWallet || !coldWallet || !hotPk) return;

  try {
    const tw = getTronWeb(hotPk);
    const contract = getUsdtContract(tw);

    const rawBalance = await contract.balanceOf(hotWallet).call();
    const balance = parseInt(rawBalance.toString(), 10) / 1e6;

    if (balance > maxHot) {
      const excess = balance - maxHot;
      await contract.transfer(coldWallet, Math.floor(excess * 1e6)).send();
      logger.info({ excess, balance }, "Rebalanced: excess swept to cold wallet");
    } else if (balance < minHot) {
      logger.warn({ balance, minHot }, "HOT WALLET BALANCE LOW — manual top-up needed");
      await sendTelegramAlert(
        `🔴 <b>MBIOPAY HOT WALLET LOW</b>\nBalance: <code>${balance.toFixed(2)} USDT</code>\nMinimum: <code>${minHot} USDT</code>\nManual top-up required.`,
      );
    }
  } catch (err) {
    logger.warn({ err }, "Rebalance error");
  }
}

// =====================
// ⏰ AUTO-EXPIRE
// =====================

async function expireStaleOrders(): Promise<void> {
  try {
    const now = new Date();
    const expired = await db
      .update(ordersTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(ordersTable.status, "waiting"),
          lt(ordersTable.expiresAt, now),
        ),
      )
      .returning({ id: ordersTable.id });

    if (expired.length > 0) {
      logger.info({ count: expired.length, ids: expired.map((o) => o.id) }, "Orders auto-expired");
      invalidateFlwBalanceCache();
    }
  } catch (err) {
    logger.warn({ err }, "Error expiring stale orders");
  }
}

// =====================
// 🚀 START
// =====================

export function startWalletWatcher() {
  logger.info("MBIO wallet watcher started (per-order polling every 15s, rebalance every 60s, expiry every 60s)");
  watchOrders();
  expireStaleOrders();
  setInterval(watchOrders, 15000);
  setInterval(rebalance, 60000);
  setInterval(expireStaleOrders, 60000);
}
