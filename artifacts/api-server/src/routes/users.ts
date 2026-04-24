import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, requireAdmin } from "../middlewares/auth";

const router = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branch_name: user.branch_name,
    district_name: user.district_name,
    mobile_number: user.mobile_number,
    created_at: user.created_at,
  };
}

router.get("/v1/users", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { role } = req.query as { role?: string };
  let query = db.select().from(usersTable);

  const users = await query;
  const filtered = role ? users.filter((u) => u.role === role) : users;
  res.json(filtered.map(sanitizeUser));
});

router.post("/v1/users", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const { name, email, password, branch_name, district_name, mobile_number } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, password_hash, role: "operator", branch_name, district_name, mobile_number })
    .returning();

  res.status(201).json(sanitizeUser(user));
});

router.get("/v1/users/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (req.user!.role !== "admin" && req.user!.id !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(sanitizeUser(user));
});

router.patch("/v1/users/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (req.user!.role !== "admin" && req.user!.id !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, branch_name, district_name, mobile_number } = req.body;

  const [user] = await db
    .update(usersTable)
    .set({ name, branch_name, district_name, mobile_number })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(sanitizeUser(user));
});

router.delete("/v1/users/:id", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (req.user!.id === id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const deleted = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
