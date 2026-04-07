import { pgTable, text, serial, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commoditiesTable = pgTable("commodities", {
  id: serial("id").primaryKey(),
  crop_name: text("crop_name").notNull(),
  crop_year: text("crop_year").notNull(),
  per_bag_per_month: numeric("per_bag_per_month", { precision: 10, scale: 2 }).notNull(),
}, (table) => [
  unique("commodities_crop_name_crop_year_unique").on(table.crop_name, table.crop_year),
]);

export const insertCommoditySchema = createInsertSchema(commoditiesTable).omit({ id: true });
export type InsertCommodity = z.infer<typeof insertCommoditySchema>;
export type Commodity = typeof commoditiesTable.$inferSelect;
