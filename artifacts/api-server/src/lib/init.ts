import { execSync } from "child_process";
import path from "path";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

async function pushSchema(): Promise<void> {
  try {
    // __dirname is set by the build banner to the dist/ folder of api-server.
    // Workspace root is 3 levels up: dist/ → api-server/ → artifacts/ → workspace root
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const dbPkg = path.join(workspaceRoot, "lib", "db");

    logger.info({ workspaceRoot, dbPkg }, "Pushing database schema...");
    execSync("pnpm run push-force", {
      cwd: dbPkg,
      stdio: "inherit",
      env: { ...process.env },
      timeout: 60_000,
    });
    logger.info("Database schema push complete.");
  } catch (err) {
    logger.error({ err }, "Schema push encountered an error — server will still start");
  }
}

async function seedAdmin(): Promise<void> {
  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    if (existing.length > 0) {
      logger.info("Admin user already exists, skipping seed.");
      return;
    }

    const hash = await bcrypt.hash("admin123", 10);
    await db.insert(usersTable).values({
      name: "Admin",
      email: "admin@mpw.com",
      password_hash: hash,
      role: "admin",
    });
    logger.info("Admin user seeded: admin@mpw.com / admin123");
  } catch (err) {
    logger.error({ err }, "Admin seed failed");
  }
}

export async function initDatabase(): Promise<void> {
  logger.info("Running database initialisation...");
  await pushSchema();
  await seedAdmin();
  logger.info("Database initialisation complete.");
}
