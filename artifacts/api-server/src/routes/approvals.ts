import { Router } from "express";
import { db, billsTable, billVersionsTable, billApprovalsTable, depositorsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, requireAdmin } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

const router = Router();

async function buildApprovalObj(approval: typeof billApprovalsTable.$inferSelect) {
  const [depositor] = approval.depositor_id
    ? await db.select().from(depositorsTable).where(eq(depositorsTable.id, approval.depositor_id))
    : [null];
  const [approver] = approval.approved_by
    ? await db.select().from(usersTable).where(eq(usersTable.id, approval.approved_by))
    : [null];

  return {
    ...approval,
    pass_amount: approval.pass_amount != null ? parseFloat(approval.pass_amount) : null,
    depositor: depositor
      ? { ...depositor, total_gst: depositor.total_gst != null ? parseFloat(depositor.total_gst) : null }
      : null,
    approver: approver
      ? { id: approver.id, name: approver.name, email: approver.email, role: approver.role, branch_name: approver.branch_name, district_name: approver.district_name, mobile_number: approver.mobile_number, created_at: approver.created_at }
      : null,
  };
}

router.get("/v1/approvals", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const approvals = await db.select().from(billApprovalsTable).orderBy(desc(billApprovalsTable.id));
  const result = await Promise.all(approvals.map(buildApprovalObj));
  res.json(result);
});

router.post("/v1/approvals/approve/:billId", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.billId) ? req.params.billId[0] : req.params.billId;
  const billId = parseInt(raw, 10);

  const { depositor_id, pass_amount, payment_method, neft_no, remark, remark_image_url } = req.body;

  if (!depositor_id || pass_amount == null || !payment_method) {
    res.status(400).json({ error: "depositor_id, pass_amount, and payment_method are required" });
    return;
  }

  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, billId));
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  if (bill.status !== "pending") {
    res.status(400).json({ error: `Bill is already ${bill.status}` });
    return;
  }

  // Update bill status
  await db
    .update(billsTable)
    .set({ status: "approved", is_locked: true })
    .where(eq(billsTable.id, billId));

  // Create approval record
  const existing = await db.select().from(billApprovalsTable).where(eq(billApprovalsTable.bill_id, billId));
  let approval;
  if (existing.length > 0) {
    [approval] = await db
      .update(billApprovalsTable)
      .set({
        depositor_id,
        pass_amount: String(pass_amount),
        payment_method,
        neft_no: neft_no ?? null,
        remark: remark ?? null,
        remark_image_url: remark_image_url ?? null,
        approved_by: req.user!.id,
        approved_at: new Date(),
      })
      .where(eq(billApprovalsTable.bill_id, billId))
      .returning();
  } else {
    [approval] = await db
      .insert(billApprovalsTable)
      .values({
        bill_id: billId,
        depositor_id,
        pass_amount: String(pass_amount),
        payment_method,
        neft_no: neft_no ?? null,
        remark: remark ?? null,
        remark_image_url: remark_image_url ?? null,
        approved_by: req.user!.id,
        approved_at: new Date(),
      })
      .returning();
  }

  // Notify operator
  await createNotification({
    user_id: bill.created_by,
    title: "Bill Approved",
    message: `Your bill (serial #${bill.serial_no}) has been approved. Pass amount: ${pass_amount}.`,
    type: "web",
  });

  // Return updated bill detail
  const [updatedBill] = await db.select().from(billsTable).where(eq(billsTable.id, billId));
  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, updatedBill.created_by));
  const versions = await db.select().from(billVersionsTable).where(eq(billVersionsTable.bill_id, billId));

  res.json({
    ...updatedBill,
    rate_per_bag: updatedBill.rate_per_bag != null ? parseFloat(updatedBill.rate_per_bag) : null,
    total_charge: updatedBill.total_charge != null ? parseFloat(updatedBill.total_charge) : null,
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
    commodity: null,
    approval: await buildApprovalObj(approval),
    versions: versions.map((v) => ({ ...v, data_json: JSON.parse(v.data_json), creator: null, bill: null })),
  });
});

router.post("/v1/approvals/reject/:billId", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.billId) ? req.params.billId[0] : req.params.billId;
  const billId = parseInt(raw, 10);
  const { reason } = req.body;

  if (!reason) {
    res.status(400).json({ error: "reason is required" });
    return;
  }

  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, billId));
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  if (bill.status !== "pending") {
    res.status(400).json({ error: `Bill is already ${bill.status}` });
    return;
  }

  await db.update(billsTable).set({ status: "rejected" }).where(eq(billsTable.id, billId));

  // Notify operator
  await createNotification({
    user_id: bill.created_by,
    title: "Bill Rejected",
    message: `Your bill (serial #${bill.serial_no}) has been rejected. Reason: ${reason}`,
    type: "web",
  });

  const [updatedBill] = await db.select().from(billsTable).where(eq(billsTable.id, billId));
  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, updatedBill.created_by));
  const versions = await db.select().from(billVersionsTable).where(eq(billVersionsTable.bill_id, billId));

  res.json({
    ...updatedBill,
    rate_per_bag: updatedBill.rate_per_bag != null ? parseFloat(updatedBill.rate_per_bag) : null,
    total_charge: updatedBill.total_charge != null ? parseFloat(updatedBill.total_charge) : null,
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
    commodity: null,
    approval: null,
    versions: versions.map((v) => ({ ...v, data_json: JSON.parse(v.data_json), creator: null, bill: null })),
  });
});

router.get("/v1/approvals/pending-versions", authMiddleware, requireAdmin, async (_req, res): Promise<void> => {
  const versions = await db
    .select()
    .from(billVersionsTable)
    .where(eq(billVersionsTable.status, "pending"))
    .orderBy(desc(billVersionsTable.created_at));

  const result = await Promise.all(versions.map(async (v) => {
    const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, v.created_by));
    const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, v.bill_id));
    return {
      ...v,
      data_json: JSON.parse(v.data_json),
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
      bill: bill ? { ...bill, rate_per_bag: bill.rate_per_bag != null ? parseFloat(bill.rate_per_bag) : null, total_charge: bill.total_charge != null ? parseFloat(bill.total_charge) : null } : null,
    };
  }));

  res.json(result);
});

router.post("/v1/approvals/versions/:versionId/approve", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;
  const versionId = parseInt(raw, 10);

  const [version] = await db.select().from(billVersionsTable).where(eq(billVersionsTable.id, versionId));
  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  if (version.status !== "pending") {
    res.status(400).json({ error: `Version is already ${version.status}` });
    return;
  }

  // Apply changes or delete based on version_type
  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, version.bill_id));

  if (version.version_type === "edit") {
    const changes = JSON.parse(version.data_json);
    const sanitizedChanges: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined && value !== null) {
        sanitizedChanges[key] = value;
      }
    }
    if (Object.keys(sanitizedChanges).length > 0) {
      await db.update(billsTable).set(sanitizedChanges as any).where(eq(billsTable.id, version.bill_id));
    }
  }
  // For delete type, we keep the bill but mark it — in full production, could actually delete

  await db.update(billVersionsTable).set({ status: "approved" }).where(eq(billVersionsTable.id, versionId));

  // Notify creator
  await createNotification({
    user_id: version.created_by,
    title: version.version_type === "edit" ? "Edit Request Approved" : "Delete Request Approved",
    message: `Your ${version.version_type} request for Bill #${bill?.serial_no} has been approved.`,
    type: "web",
  });

  const [updatedVersion] = await db.select().from(billVersionsTable).where(eq(billVersionsTable.id, versionId));
  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, updatedVersion.created_by));

  res.json({
    ...updatedVersion,
    data_json: JSON.parse(updatedVersion.data_json),
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
    bill: null,
  });
});

router.post("/v1/approvals/versions/:versionId/reject", authMiddleware, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;
  const versionId = parseInt(raw, 10);
  const { reason } = req.body;

  const [version] = await db.select().from(billVersionsTable).where(eq(billVersionsTable.id, versionId));
  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  if (version.status !== "pending") {
    res.status(400).json({ error: `Version is already ${version.status}` });
    return;
  }

  await db.update(billVersionsTable).set({ status: "rejected" }).where(eq(billVersionsTable.id, versionId));

  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, version.bill_id));

  // Notify creator
  await createNotification({
    user_id: version.created_by,
    title: version.version_type === "edit" ? "Edit Request Rejected" : "Delete Request Rejected",
    message: `Your ${version.version_type} request for Bill #${bill?.serial_no} has been rejected. ${reason ? "Reason: " + reason : ""}`,
    type: "web",
  });

  const [updatedVersion] = await db.select().from(billVersionsTable).where(eq(billVersionsTable.id, versionId));
  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, updatedVersion.created_by));

  res.json({
    ...updatedVersion,
    data_json: JSON.parse(updatedVersion.data_json),
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
    bill: null,
  });
});

export default router;
