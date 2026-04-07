import { Router } from "express";
import { db, commoditiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/v1/commodities", authMiddleware, async (_req, res): Promise<void> => {
  const commodities = await db.select().from(commoditiesTable);
  res.json(commodities.map((c) => ({
    ...c,
    per_bag_per_month: parseFloat(c.per_bag_per_month),
  })));
});

router.post("/v1/commodities", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { crop_name, crop_year, per_bag_per_month } = req.body;
  if (!crop_name || !crop_year || per_bag_per_month == null) {
    res.status(400).json({ error: "crop_name, crop_year, and per_bag_per_month are required" });
    return;
  }

  const [commodity] = await db
    .insert(commoditiesTable)
    .values({ crop_name, crop_year, per_bag_per_month: String(per_bag_per_month) })
    .returning();

  res.status(201).json({ ...commodity, per_bag_per_month: parseFloat(commodity.per_bag_per_month) });
});

router.get("/v1/commodities/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [commodity] = await db.select().from(commoditiesTable).where(eq(commoditiesTable.id, id));
  if (!commodity) {
    res.status(404).json({ error: "Commodity not found" });
    return;
  }
  res.json({ ...commodity, per_bag_per_month: parseFloat(commodity.per_bag_per_month) });
});

router.patch("/v1/commodities/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { crop_name, crop_year, per_bag_per_month } = req.body;

  const updates: Record<string, unknown> = {};
  if (crop_name) updates.crop_name = crop_name;
  if (crop_year) updates.crop_year = crop_year;
  if (per_bag_per_month != null) updates.per_bag_per_month = String(per_bag_per_month);

  const [commodity] = await db
    .update(commoditiesTable)
    .set(updates)
    .where(eq(commoditiesTable.id, id))
    .returning();

  if (!commodity) {
    res.status(404).json({ error: "Commodity not found" });
    return;
  }
  res.json({ ...commodity, per_bag_per_month: parseFloat(commodity.per_bag_per_month) });
});

export default router;
