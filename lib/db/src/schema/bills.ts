import { pgTable, text, serial, integer, numeric, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { commoditiesTable } from "./commodities";

export const billStatusEnum = pgEnum("bill_status", ["pending", "approved", "rejected"]);
export const versionTypeEnum = pgEnum("version_type", ["edit", "delete"]);

export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  serial_no: serial("serial_no").unique(),
  created_by: integer("created_by").notNull().references(() => usersTable.id),
  district: text("district"),
  branch_name: text("branch_name"),
  godown_name: text("godown_name"),
  bill_no: text("bill_no"),
  commodity_id: integer("commodity_id").notNull().references(() => commoditiesTable.id),
  crop_year: text("crop_year"),
  financial_year: text("financial_year"),
  month_year: text("month_year"),
  rate_per_bag: numeric("rate_per_bag", { precision: 10, scale: 2 }),
  opening_balance: integer("opening_balance"),
  closing_balance: integer("closing_balance"),
  received_bags: integer("received_bags"),
  issue_bags: integer("issue_bags"),
  reserve_bags: integer("reserve_bags"),
  chargeable_bags: integer("chargeable_bags"),
  total_charge: numeric("total_charge", { precision: 12, scale: 2 }),
  status: billStatusEnum("status").notNull().default("pending"),
  is_locked: boolean("is_locked").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("bills_serial_no_idx").on(table.serial_no),
  index("bills_status_idx").on(table.status),
  index("bills_created_by_idx").on(table.created_by),
  index("bills_commodity_id_idx").on(table.commodity_id),
]);

export const insertBillSchema = createInsertSchema(billsTable).omit({ id: true, serial_no: true, created_at: true });
export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof billsTable.$inferSelect;

export const billVersionsTable = pgTable("bill_versions", {
  id: serial("id").primaryKey(),
  bill_id: integer("bill_id").notNull().references(() => billsTable.id),
  data_json: text("data_json").notNull().default("{}"),
  version_type: versionTypeEnum("version_type").notNull().default("edit"),
  status: billStatusEnum("status").notNull().default("pending"),
  created_by: integer("created_by").notNull().references(() => usersTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBillVersionSchema = createInsertSchema(billVersionsTable).omit({ id: true, created_at: true });
export type InsertBillVersion = z.infer<typeof insertBillVersionSchema>;
export type BillVersion = typeof billVersionsTable.$inferSelect;
