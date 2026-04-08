import { db, notificationsTable } from "@workspace/db";
import { logger } from "./logger";

export async function createNotification(params: {
  user_id: number;
  title: string;
  message: string;
  type?: "web" | "email";
  link_url?: string;
}): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      user_id: params.user_id,
      title: params.title,
      message: params.message,
      type: params.type ?? "web",
      is_read: false,
      link_url: params.link_url ?? null,
    });
    if (params.type === "email") {
      logger.info({ user_id: params.user_id, title: params.title }, "Email notification (mock): would send email");
    }
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
  }
}
