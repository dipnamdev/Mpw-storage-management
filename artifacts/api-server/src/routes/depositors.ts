import { Router } from "express";
import { db, depositorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, requireAdmin } from "../middlewares/auth";

const router = Router();

function sanitizeDepositor(d: typeof depositorsTable.$inferSelect) {
  return {
    id: d.id,
    name: d.name,
    gst_no: d.gst_no,
    total_gst: d.total_gst != null ? parseFloat(d.total_gst) : null,
  };
}

router.get("/v1/depositors", authMiddleware, async (_req, res): Promise<void> => {
  const depositors = await db.select().from(depositorsTable);
  res.json(depositors.map(sanitizeDepositor));
});

router.post("/v1/depositors", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { name, gst_no, total_gst } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [depositor] = await db
    .insert(depositorsTable)
    .values({ name, gst_no: gst_no ?? null, total_gst: total_gst != null ? String(total_gst) : null })
    .returning();

  res.status(201).json(sanitizeDepositor(depositor));
});

router.get("/v1/depositors/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [depositor] = await db.select().from(depositorsTable).where(eq(depositorsTable.id, id));
  if (!depositor) {
    res.status(404).json({ error: "Depositor not found" });
    return;
  }
  res.json(sanitizeDepositor(depositor));
});

export default router;
