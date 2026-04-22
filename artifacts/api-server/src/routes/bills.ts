import { Router } from "express";
import { db, billsTable, billVersionsTable, commoditiesTable, usersTable, billApprovalsTable, depositorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
  const depositors = await db.select().from(depositorsTable);

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
    depositors: depositors.map((d) => ({ id: d.id, name: d.name, gst_no: d.gst_no })),
  });
});

router.get("/v1/bills", authMiddleware, async (req, res): Promise<void> => {
  const { status, district, branch_name, financial_year, month_year, commodity_id, depositor_id, created_by, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const offset = (pageNum - 1) * limitNum;

  let bills = await db.select().from(billsTable).orderBy(desc(billsTable.created_at));

  if (req.user!.role === "operator") {
    bills = bills.filter((b) => b.created_by === req.user!.id);
  }

  if (status) bills = bills.filter((b) => b.status === status);
  if (district) bills = bills.filter((b) => b.district === district);
  if (branch_name) bills = bills.filter((b) => b.branch_name === branch_name);
  if (financial_year) bills = bills.filter((b) => b.financial_year === financial_year);
  if (month_year) bills = bills.filter((b) => b.month_year === month_year);
  if (commodity_id) bills = bills.filter((b) => b.commodity_id === parseInt(commodity_id, 10));
  if (depositor_id) bills = bills.filter((b) => b.depositor_id === parseInt(depositor_id, 10));
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

router.get("/v1/bills/cycle-lookup", authMiddleware, async (req, res): Promise<void> => {
  const { bill_no } = req.query as Record<string, string>;
  if (!bill_no) {
    res.json({ found: false });
    return;
  }

  const bills = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.bill_no, bill_no))
    .orderBy(desc(billsTable.created_at));

  const filtered = req.user!.role === "operator"
    ? bills.filter((b) => b.created_by === req.user!.id)
    : bills;

  if (filtered.length === 0) {
    res.json({ found: false });
    return;
  }

  const latest = filtered[0];
  res.json({
    found: true,
    closing_balance: latest.closing_balance,
    cycle: latest.cycle,
    serial_no: latest.serial_no,
    month_year: latest.month_year,
    district: latest.district,
    branch_name: latest.branch_name,
    godown_name: latest.godown_name,
    commodity_id: latest.commodity_id,
    depositor_id: latest.depositor_id,
    crop_year: latest.crop_year,
    financial_year: latest.financial_year,
    rate_per_bag: latest.rate_per_bag,
  });
});

router.post("/v1/bills", authMiddleware, async (req, res): Promise<void> => {
  const { godown_name, bill_no, bill_type, gst_bill_no, deduction_amount, commodity_id, depositor_id, crop_year, financial_year, month_year, billing_date, rate_per_bag, opening_balance, received_bags, issue_bags, reserve_bags } = req.body;
  let { district, branch_name } = req.body;

  if (!commodity_id) {
    res.status(400).json({ error: "commodity_id is required" });
    return;
  }

  if (req.user!.role === "operator") {
    district = req.user!.district_name ?? district;
    branch_name = req.user!.branch_name ?? branch_name;
  }

  if (branch_name) branch_name = branch_name.toUpperCase();

  const [commodity] = await db.select().from(commoditiesTable).where(eq(commoditiesTable.id, commodity_id));
  if (!commodity) {
    res.status(400).json({ error: "Commodity not found" });
    return;
  }

  const billingDateObj: Date = billing_date ? new Date(billing_date) : new Date();
  const billingDay = billingDateObj.getDate();
  const cycle = billingDay <= 15 ? 1 : 2;

  const openingBal = opening_balance != null ? parseInt(String(opening_balance), 10) : 0;
  const receivedBags = received_bags != null ? parseInt(String(received_bags), 10) : 0;
  const issueBags = issue_bags != null ? parseInt(String(issue_bags), 10) : 0;
  const reserveBags = reserve_bags != null ? parseInt(String(reserve_bags), 10) : 0;
  const chargeableBags = openingBal + receivedBags;
  const closingBal = openingBal + receivedBags - issueBags + reserveBags;
  const perBagPerMonth = parseFloat(commodity.per_bag_per_month);
  const total_charge = chargeableBags * perBagPerMonth / 2;
  const passAmount = deduction_amount != null ? parseFloat(String(deduction_amount)) : total_charge;

  const [bill] = await db
    .insert(billsTable)
    .values({
      created_by: req.user!.id,
      district,
      branch_name,
      godown_name,
      bill_no,
      commodity_id,
      depositor_id: depositor_id ? parseInt(depositor_id, 10) : null,
      crop_year,
      financial_year,
      month_year,
      billing_date: billingDateObj,
      cycle,
      rate_per_bag: rate_per_bag != null ? String(rate_per_bag) : null,
      opening_balance: openingBal,
      closing_balance: closingBal,
      received_bags: receivedBags,
      issue_bags: issueBags,
      reserve_bags: reserveBags,
      chargeable_bags: chargeableBags,
      total_charge: String(total_charge),
      status: "pending",
      is_locked: false,
    })
    .returning();

  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  for (const admin of admins) {
    await createNotification({
      user_id: admin.id,
      title: "New Bill Created",
      message: `A new bill (serial #${bill.serial_no}) has been submitted by ${req.user!.name} and is pending review.`,
      type: "web",
      link_url: `/bills/${bill.id}`,
    });
  }

  const detail = await buildBillDetail(bill);
  res.status(201).json({ ...detail, bill_type, gst_bill_no, deduction_amount: deduction_amount != null ? parseFloat(String(deduction_amount)) : null, pass_amount: passAmount });
});

router.get("/v1/bills/export", authMiddleware, async (req, res): Promise<void> => {
  const { status, branch_name, month_year } = req.query as Record<string, string>;

  let bills = await db.select().from(billsTable).orderBy(desc(billsTable.created_at));

  if (status) bills = bills.filter((bill) => bill.status === status);
  if (branch_name) bills = bills.filter((bill) => bill.branch_name === branch_name);
  if (month_year) bills = bills.filter((bill) => bill.month_year === month_year);

  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csvRows = [
    ["Serial No", "Bill No", "Billing Date", "Cycle", "District", "Branch", "Godown", "Commodity ID", "Depositor ID", "Month-Year", "Rate/Bag", "Opening", "Received", "Issue", "Reserve", "Chargeable", "Closing", "Total Charge"],
    ...bills.map((bill) => [
      bill.serial_no,
      bill.bill_no ?? "",
      bill.billing_date ? new Date(bill.billing_date).toISOString() : "",
      bill.cycle ?? "",
      bill.district ?? "",
      bill.branch_name ?? "",
      bill.godown_name ?? "",
      bill.commodity_id,
      bill.depositor_id ?? "",
      bill.month_year ?? "",
      bill.rate_per_bag ?? "",
      bill.opening_balance ?? "",
      bill.received_bags ?? "",
      bill.issue_bags ?? "",
      bill.reserve_bags ?? "",
      bill.chargeable_bags ?? "",
      bill.closing_balance ?? "",
      bill.total_charge ?? "",
    ]),
  ];

  res.header("Content-Type", "text/csv");
  res.attachment("bills.csv");
  res.send(csvRows.map((row) => row.map(escapeCsv).join(",")).join("\n"));
});

export default router;
