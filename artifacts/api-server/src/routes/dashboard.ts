import { Router } from "express";
import { db, billsTable, billApprovalsTable, billVersionsTable, notificationsTable, usersTable, commoditiesTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.get("/v1/dashboard/stats", authMiddleware, async (req, res): Promise<void> => {
  const allBills = await db.select().from(billsTable).orderBy(desc(billsTable.created_at));

  const totalBills = allBills.length;
  const pendingBills = allBills.filter((b) => b.status === "pending").length;
  const approvedBills = allBills.filter((b) => b.status === "approved").length;
  const rejectedBills = allBills.filter((b) => b.status === "rejected").length;

  const approvals = await db.select().from(billApprovalsTable);
  let totalApprovedAmount = 0;
  for (const a of approvals) {
    if (a.pass_amount) totalApprovedAmount += parseFloat(a.pass_amount);
  }

  const pendingVersions = await db.select().from(billVersionsTable).where(eq(billVersionsTable.status, "pending"));
  const pendingEditRequests = pendingVersions.length;

  const billsByStatus = [
    { status: "pending", count: pendingBills },
    { status: "approved", count: approvedBills },
    { status: "rejected", count: rejectedBills },
  ];

  // Build recent bills (last 5)
  const recentBillsRaw = allBills.slice(0, 5);
  const recentBills = await Promise.all(recentBillsRaw.map(async (bill) => {
    const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, bill.created_by));
    const [commodity] = await db.select().from(commoditiesTable).where(eq(commoditiesTable.id, bill.commodity_id));
    const [approval] = await db.select().from(billApprovalsTable).where(eq(billApprovalsTable.bill_id, bill.id));

    return {
      ...bill,
      rate_per_bag: bill.rate_per_bag != null ? parseFloat(bill.rate_per_bag) : null,
      total_charge: bill.total_charge != null ? parseFloat(bill.total_charge) : null,
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
      commodity: commodity ? { ...commodity, per_bag_per_month: parseFloat(commodity.per_bag_per_month) } : null,
      approval: approval ? { ...approval, pass_amount: approval.pass_amount != null ? parseFloat(approval.pass_amount) : null, depositor: null, approver: null } : null,
      versions: [],
    };
  }));

  const unreadNotifications = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.user_id, req.user!.id), eq(notificationsTable.is_read, false)));

  res.json({
    total_bills: totalBills,
    pending_bills: pendingBills,
    approved_bills: approvedBills,
    rejected_bills: rejectedBills,
    total_approved_amount: totalApprovedAmount,
    pending_edit_requests: pendingEditRequests,
    bills_by_status: billsByStatus,
    recent_bills: recentBills,
    unread_notifications: unreadNotifications.length,
  });
});

export default router;
