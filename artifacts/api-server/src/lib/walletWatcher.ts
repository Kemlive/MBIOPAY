import axios from "axios";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";
import { encrypt, decrypt } from "./encryption";
import { getDynamicRate } from "./dynamicRate";

const { TronWeb } = require("tronweb") as { TronWeb: any };

const TRONGRID_BASE = "https://api.trongrid.io";
const USDT_CONTRACT = process.env.USDT_CONTRACT ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const MIN_CONFIRMATIONS = 3;

// =====================
// 🏦 TRON ACCOUNT
// =====================

function getTronWeb(privateKey?: string): any {
  return new TronWeb({
    fullHost: TRONGRID_BASE,
    privateKey: privateKey ?? process.env.HOT_PRIVATE_KEY ?? "",
  });
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

export async function getFlutterwaveUgxBalance(): Promise<number> {
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
    return cachedFlwBalance?.ugx ?? 0;
  }
}

export function invalidateFlwBalanceCache() {
  cachedFlwBalance = null;
}

// =====================
// 🔍 CONFIRMATIONS
// =====================

async function getConfirmations(txid: string, tw: TronWeb): Promise<number> {
  try {
    const tx = await tw.trx.getTransaction(txid) as any;
    const block = await tw.trx.getCurrentBlock() as any;
    const txBlock: number = tx?.blockNumber ?? 0;
    const currentBlock: number = block?.block_header?.raw_data?.number ?? 0;
    return currentBlock - txBlock;
  } catch {
    return 0;
  }
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

    await db
      .update(ordersTable)
      .set({ status: "completed", ugxAmount: ugx, updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const responseData = axios.isAxiosError(err) ? err.response?.data : undefined;
    logger.error({ orderId, error: message, responseData }, "Flutterwave payout failed");

    await db
      .update(ordersTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));
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
      const contract = await tw.contract().at(USDT_CONTRACT);
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
        const res = await axios.get(
          `${TRONGRID_BASE}/v1/accounts/${order.depositAddress}/transactions/trc20`,
          {
            params: { limit: 5, contract_address: USDT_CONTRACT, only_to: "true" },
            headers: { Accept: "application/json" },
            timeout: 12000,
          }
        );

        const txs: Array<{ transaction_id: string; value: string; token_info?: { decimals?: number } }> =
          res.data?.data ?? [];

        for (const tx of txs) {
          const decimals = tx.token_info?.decimals ?? 6;
          const received = parseInt(tx.value, 10) / Math.pow(10, decimals);

          if (!order.amount || Math.abs(received - order.amount) > 0.5) continue;

          const confs = await getConfirmations(tx.transaction_id, tw);
          if (confs < MIN_CONFIRMATIONS) {
            logger.info({ txid: tx.transaction_id, confs }, "Awaiting confirmations");
            continue;
          }

          await db
            .update(ordersTable)
            .set({ status: "processing", txid: tx.transaction_id, updatedAt: new Date() })
            .where(eq(ordersTable.id, order.id));

          logger.info({ orderId: order.id, txid: tx.transaction_id, received }, "Deposit confirmed");

          await sweep(order, received);
          await executePayout(order.id, order.phone, order.network, received);
          break;
        }
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
    const contract = await tw.contract().at(USDT_CONTRACT);

    const rawBalance = await contract.balanceOf(hotWallet).call();
    const balance = parseInt(rawBalance.toString(), 10) / 1e6;

    if (balance > maxHot) {
      const excess = balance - maxHot;
      await contract.transfer(coldWallet, Math.floor(excess * 1e6)).send();
      logger.info({ excess, balance }, "Rebalanced: excess swept to cold wallet");
    } else if (balance < minHot) {
      logger.warn({ balance, minHot }, "HOT WALLET BALANCE LOW — manual top-up needed");
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
