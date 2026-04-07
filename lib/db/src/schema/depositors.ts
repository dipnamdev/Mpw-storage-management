import { pgTable, text, serial, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const depositorsTable = pgTable("depositors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gst_no: text("gst_no"),
  total_gst: numeric("total_gst", { precision: 12, scale: 2 }),
});

export const insertDepositorSchema = createInsertSchema(depositorsTable).omit({ id: true });
export type InsertDepositor = z.infer<typeof insertDepositorSchema>;
export type Depositor = typeof depositorsTable.$inferSelect;
