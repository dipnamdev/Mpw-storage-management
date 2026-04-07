import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { billsTable } from "./bills";
import { depositorsTable } from "./depositors";
import { usersTable } from "./users";

export const billApprovalsTable = pgTable("bill_approvals", {
  id: serial("id").primaryKey(),
  bill_id: integer("bill_id").notNull().references(() => billsTable.id).unique(),
  depositor_id: integer("depositor_id").references(() => depositorsTable.id),
  pass_amount: numeric("pass_amount", { precision: 12, scale: 2 }),
  payment_method: text("payment_method"),
  neft_no: text("neft_no"),
  remark: text("remark"),
  remark_image_url: text("remark_image_url"),
  approved_by: integer("approved_by").references(() => usersTable.id),
  approved_at: timestamp("approved_at", { withTimezone: true }),
});

export const insertBillApprovalSchema = createInsertSchema(billApprovalsTable).omit({ id: true });
export type InsertBillApproval = z.infer<typeof insertBillApprovalSchema>;
export type BillApproval = typeof billApprovalsTable.$inferSelect;
