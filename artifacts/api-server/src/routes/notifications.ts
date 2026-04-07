import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.get("/v1/notifications", authMiddleware, async (req, res): Promise<void> => {
  const { unread_only } = req.query;

  let notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.user_id, req.user!.id))
    .orderBy(desc(notificationsTable.created_at));

  if (unread_only === "true") {
    notifications = notifications.filter((n) => !n.is_read);
  }

  res.json(notifications);
});

router.patch("/v1/notifications/:id/read", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [notification] = await db
    .update(notificationsTable)
    .set({ is_read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.user_id, req.user!.id)))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(notification);
});

router.patch("/v1/notifications/read-all", authMiddleware, async (req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ is_read: true })
    .where(eq(notificationsTable.user_id, req.user!.id));

  res.json({ message: "All notifications marked as read" });
});

export default router;
