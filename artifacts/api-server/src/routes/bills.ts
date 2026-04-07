import { Router } from "express";
import { db, billsTable, billVersionsTable, commoditiesTable, usersTable, billApprovalsTable, depositorsTable } from "@workspace/db";
import { eq, and, desc, count, SQL } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";

const router = Router();

async function buildBillDetail(bill: typeof billsTable.$inferSelect) {
  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, bill.created_by));
  const [commodity] = await db.select().from(commoditiesTable).where(eq(commoditiesTable.id, bill.commodity_id));
  const [approval] = await db.select().from(billApprovalsTable).where(eq(billApprovalsTable.bill_id, bill.id));
  const versions = await db.select().from(billVersionsTable).where(eq(billVersionsTable.bill_id, bill.id)).orderBy(desc(billVersionsTable.created_at));

  let approvalObj = null;
  if (approval) {
    const [depositor] = approval.depositor_id ? await db.select().from(depositorsTable).where(eq(depositorsTable.id, approval.depositor_id)) : [null];
    const [approver] = approval.approved_by ? await db.select().from(usersTable).where(eq(usersTable.id, approval.approved_by)) : [null];
    approvalObj = {
      ...approval,
      pass_amount: approval.pass_amount != null ? parseFloat(approval.pass_amount) : null,
      depositor: depositor ? { ...depositor, total_gst: depositor.total_gst != null ? parseFloat(depositor.total_gst) : null } : null,
      approver: approver ? { id: approver.id, name: approver.name, email: approver.email, role: approver.role, branch_name: approver.branch_name, district_name: approver.district_name, mobile_number: approver.mobile_number, created_at: approver.created_at } : null,
    };
  }

  const versionObjs = await Promise.all(versions.map(async (v) => {
    const [vCreator] = await db.select().from(usersTable).where(eq(usersTable.id, v.created_by));
    return {
      ...v,
      data_json: JSON.parse(v.data_json),
      creator: vCreator ? { id: vCreator.id, name: vCreator.name, email: vCreator.email, role: vCreator.role, branch_name: vCreator.branch_name, district_name: vCreator.district_name, mobile_number: vCreator.mobile_number, created_at: vCreator.created_at } : null,
      bill: null,
    };
  }));

  return {
    ...bill,
    rate_per_bag: bill.rate_per_bag != null ? parseFloat(bill.rate_per_bag) : null,
    total_charge: bill.total_charge != null ? parseFloat(bill.total_charge) : null,
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
    commodity: commodity ? { ...commodity, per_bag_per_month: parseFloat(commodity.per_bag_per_month) } : null,
    approval: approvalObj,
    versions: versionObjs,
  };
}

router.get("/v1/bills/filter-options", authMiddleware, async (req, res): Promise<void> => {
  let bills = await db.select().from(billsTable);

  if (req.user!.role === "operator") {
    bills = bills.filter((b) => b.created_by === req.user!.id);
  }

  const unique = <T>(arr: (T | null | undefined)[]) =>
    [...new Set(arr.filter((x): x is T => x != null && x !== ""))].sort() as T[];

  res.json({
    districts: unique(bills.map((b) => b.district)),
    branch_names: unique(bills.map((b) => b.branch_name)),
    financial_years: unique(bills.map((b) => b.financial_year)),
    month_years: unique(bills.map((b) => b.month_year)),
  });
});

router.get("/v1/bills", authMiddleware, async (req, res): Promise<void> => {
  const { status, district, branch_name, financial_year, month_year, commodity_id, created_by, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const offset = (pageNum - 1) * limitNum;

  let bills = await db.select().from(billsTable).orderBy(desc(billsTable.created_at));

  // For operators, only show their own bills
  if (req.user!.role === "operator") {
    bills = bills.filter((b) => b.created_by === req.user!.id);
  }

  if (status) bills = bills.filter((b) => b.status === status);
  if (district) bills = bills.filter((b) => b.district === district);
  if (branch_name) bills = bills.filter((b) => b.branch_name === branch_name);
  if (financial_year) bills = bills.filter((b) => b.financial_year === financial_year);
  if (month_year) bills = bills.filter((b) => b.month_year === month_year);
  if (commodity_id) bills = bills.filter((b) => b.commodity_id === parseInt(commodity_id, 10));
  if (created_by && req.user!.role === "admin") bills = bills.filter((b) => b.created_by === parseInt(created_by, 10));

  const total = bills.length;
  const paginated = bills.slice(offset, offset + limitNum);

  const detailedBills = await Promise.all(paginated.map(buildBillDetail));

  res.json({
    bills: detailedBills,
    total,
    page: pageNum,
    limit: limitNum,
    total_pages: Math.ceil(total / limitNum),
  });
});

router.post("/v1/bills", authMiddleware, async (req, res): Promise<void> => {
  const { district, branch_name, godown_name, bill_no, commodity_id, crop_year, financial_year, month_year, rate_per_bag, opening_balance, closing_balance, received_bags, issue_bags, reserve_bags, chargeable_bags } = req.body;

  if (!commodity_id) {
    res.status(400).json({ error: "commodity_id is required" });
    return;
  }

  const [commodity] = await db.select().from(commoditiesTable).where(eq(commoditiesTable.id, commodity_id));
  if (!commodity) {
    res.status(400).json({ error: "Commodity not found" });
    return;
  }

  const receivedBagsNum = received_bags ? parseInt(received_bags, 10) : 0;
  const perBagPerMonth = parseFloat(commodity.per_bag_per_month);
  const total_charge = receivedBagsNum * perBagPerMonth / 2;

  const [bill] = await db
    .insert(billsTable)
    .values({
      created_by: req.user!.id,
      district,
      branch_name,
      godown_name,
      bill_no,
      commodity_id,
      crop_year,
      financial_year,
      month_year,
      rate_per_bag: rate_per_bag != null ? String(rate_per_bag) : null,
      opening_balance: opening_balance != null ? parseInt(opening_balance, 10) : null,
      closing_balance: closing_balance != null ? parseInt(closing_balance, 10) : null,
      received_bags: receivedBagsNum,
      issue_bags: issue_bags != null ? parseInt(issue_bags, 10) : null,
      reserve_bags: reserve_bags != null ? parseInt(reserve_bags, 10) : null,
      chargeable_bags: chargeable_bags != null ? parseInt(chargeable_bags, 10) : null,
      total_charge: String(total_charge),
      status: "pending",
      is_locked: false,
    })
    .returning();

  // Notify all admins
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  for (const admin of admins) {
    await createNotification({
      user_id: admin.id,
      title: "New Bill Created",
      message: `A new bill (serial #${bill.serial_no}) has been submitted by ${req.user!.name} and is pending review.`,
      type: "web",
    });
  }

  const detail = await buildBillDetail(bill);
  res.status(201).json(detail);
});

router.get("/v1/bills/export", authMiddleware, async (req, res): Promise<void> => {
  const { status, branch_name, month_year } = req.query as Record<string, string>;

  let bills = await db.select().from(billsTable).orderBy(desc(billsTable.created_at));

  if (status) bills = bills.filter((b) => b.status === status);
  if (branch_name) bills = bills.filter((b) => b.branch_name === branch_name);
  if (month_year) bills = bills.filter((b) => b.month_year === month_year);

  const rows = bills.map((b) => [
    b.serial_no, b.bill_no ?? "", b.district ?? "", b.branch_name ?? "", b.godown_name ?? "",
    b.month_year ?? "", b.crop_year ?? "", b.financial_year ?? "",
    b.opening_balance ?? 0, b.received_bags ?? 0, b.issue_bags ?? 0, b.closing_balance ?? 0,
    b.reserve_bags ?? 0, b.chargeable_bags ?? 0, b.total_charge ?? 0, b.status,
  ].join(",")).join("\n");

  const header = "serial_no,bill_no,district,branch_name,godown_name,month_year,crop_year,financial_year,opening_balance,received_bags,issue_bags,closing_balance,reserve_bags,chargeable_bags,total_charge,status";

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=bills.csv");
  res.send(header + "\n" + rows);
});

router.get("/v1/bills/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, id));
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  if (req.user!.role === "operator" && bill.created_by !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const detail = await buildBillDetail(bill);
  res.json(detail);
});

router.post("/v1/bills/:id/request-edit", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, id));
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  if (bill.is_locked) {
    res.status(400).json({ error: "Bill is locked and cannot be edited" });
    return;
  }

  if (req.user!.role === "operator" && bill.created_by !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [version] = await db
    .insert(billVersionsTable)
    .values({
      bill_id: id,
      data_json: JSON.stringify(req.body),
      version_type: "edit",
      status: "pending",
      created_by: req.user!.id,
    })
    .returning();

  // Notify admins
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  for (const admin of admins) {
    await createNotification({
      user_id: admin.id,
      title: "Edit Request Submitted",
      message: `An edit request has been submitted for Bill #${bill.serial_no} by ${req.user!.name}.`,
      type: "web",
    });
  }

  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, version.created_by));
  res.status(201).json({
    ...version,
    data_json: JSON.parse(version.data_json),
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
    bill: null,
  });
});

router.post("/v1/bills/:id/request-delete", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [bill] = await db.select().from(billsTable).where(eq(billsTable.id, id));
  if (!bill) {
    res.status(404).json({ error: "Bill not found" });
    return;
  }

  if (bill.is_locked) {
    res.status(400).json({ error: "Bill is locked and cannot be deleted" });
    return;
  }

  if (req.user!.role === "operator" && bill.created_by !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [version] = await db
    .insert(billVersionsTable)
    .values({
      bill_id: id,
      data_json: JSON.stringify({}),
      version_type: "delete",
      status: "pending",
      created_by: req.user!.id,
    })
    .returning();

  // Notify admins
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  for (const admin of admins) {
    await createNotification({
      user_id: admin.id,
      title: "Delete Request Submitted",
      message: `A delete request has been submitted for Bill #${bill.serial_no} by ${req.user!.name}.`,
      type: "web",
    });
  }

  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, version.created_by));
  res.status(201).json({
    ...version,
    data_json: JSON.parse(version.data_json),
    creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
    bill: null,
  });
});

router.get("/v1/bills/:id/versions", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const versions = await db
    .select()
    .from(billVersionsTable)
    .where(eq(billVersionsTable.bill_id, id))
    .orderBy(desc(billVersionsTable.created_at));

  const result = await Promise.all(versions.map(async (v) => {
    const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, v.created_by));
    return {
      ...v,
      data_json: JSON.parse(v.data_json),
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email, role: creator.role, branch_name: creator.branch_name, district_name: creator.district_name, mobile_number: creator.mobile_number, created_at: creator.created_at } : null,
      bill: null,
    };
  }));

  res.json(result);
});

export default router;
