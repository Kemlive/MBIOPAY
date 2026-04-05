import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Immutable append-only audit log for every order state transition.
 * Never update rows here — only INSERT.
 * Gives you a full history: waiting → processing → completed (or failed/expired).
 */
export const orderAuditLogTable = pgTable("order_audit_log", {
  id:         serial("id").primaryKey(),
  orderId:    integer("order_id").notNull(),
  fromStatus: text("from_status"),                    // null on first insert
  toStatus:   text("to_status").notNull(),
  triggeredBy: text("triggered_by").notNull(),        // "watcher" | "admin" | "expiry" | "api"
  meta:       jsonb("meta"),                          // txid, ugxAmount, error, etc.
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export type OrderAuditLog = typeof orderAuditLogTable.$inferSelect;
