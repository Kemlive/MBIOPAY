import { pgTable, serial, text, real, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  phone: text("phone").notNull(),
  network: text("network").notNull(),
  amount: real("amount"),
  ugxAmount: real("ugx_amount"),
  status: text("status").notNull().default("waiting"),
  txid: text("txid"),
  depositAddress: text("deposit_address"),
  encryptedPk: text("encrypted_pk"),
  expiresAt: timestamp("expires_at"),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  unique("orders_idempotency_key_unique").on(t.idempotencyKey),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
