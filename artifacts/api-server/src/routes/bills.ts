import { Router } from "express";
import multer from "multer";
import { db, billsTable, billVersionsTable, commoditiesTable, usersTable, billApprovalsTable, depositorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";

const router = Router();

// In-memory upload for CSV import — small files only
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// --- CSV helpers ---
function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  // Strings are stored as user-entered text (e.g. "23-04-2026") — pass through unchanged
  if (typeof value === "string") return value.trim();
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function joinNoAndDate(no: string | null | undefined, date: string | Date | null | undefined): string {
  const n = (no ?? "").toString().trim();
  const d = fmtDate(date as any);
  if (!n && !d) return "";
  if (!d) return n;
  if (!n) return d;
  return `${n} | ${d}`;
}

function splitNoAndDate(value: string | undefined): { no: string | null; date: string | null } {
  if (!value || !value.trim()) return { no: null, date: null };
  const parts = value.split("|").map((s) => s.trim());
  const no = parts[0] || null;
  const date = parts[1] || null;
  return { no, date };
}

// Robust line-aware CSV parser (handles quoted fields, escaped quotes, embedded commas/newlines)
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch === "\r") { /* skip */ }
      else cell += ch;
    }
  }
  // last cell / row
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

// Defensive escape against CSV/Excel formula injection.
// Cells beginning with =, +, -, @, tab or CR can be evaluated as formulas in Excel/Sheets.
// Prefix such values with a single quote to neutralise them.
function csvSafe(value: unknown): string {
  let s = String(value ?? "");
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function parseNumber(v: string | undefined): string | null {
  if (v == null) return null;
  const cleaned = String(v).replace(/[,₹\s]/g, "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!isFinite(n)) return null;
  return n.toFixed(2);
}

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

router.get("/v1/bills/stats", authMiddleware, async (req, res): Promise<void> => {
  const { status, district, branch_name, financial_year, month_year, commodity_id, depositor_id, created_by } = req.query as Record<string, string>;

  let bills = await db.select().from(billsTable);
  if (req.user!.role === "operator") bills = bills.filter((b) => b.created_by === req.user!.id);
  if (status) bills = bills.filter((b) => b.status === status);
  if (district) bills = bills.filter((b) => b.district === district);
  if (branch_name) bills = bills.filter((b) => b.branch_name === branch_name);
  if (financial_year) bills = bills.filter((b) => b.financial_year === financial_year);
  if (month_year) bills = bills.filter((b) => b.month_year === month_year);
  if (commodity_id) bills = bills.filter((b) => b.commodity_id === parseInt(commodity_id, 10));
  if (depositor_id) bills = bills.filter((b) => b.depositor_id === parseInt(depositor_id, 10));
  if (created_by && req.user!.role === "admin") bills = bills.filter((b) => b.created_by === parseInt(created_by, 10));

  const sumCharge = (arr: typeof bills) =>
    arr.reduce((s, b) => s + (b.total_charge != null ? parseFloat(b.total_charge) || 0 : 0), 0);

  const approvedBills = bills.filter((b) => b.status === "approved");
  const rejectedBills = bills.filter((b) => b.status === "rejected");
  const pendingBills = bills.filter((b) => b.status === "pending");

  res.json({
    total: bills.length,
    approved: approvedBills.length,
    rejected: rejectedBills.length,
    pending: pendingBills.length,
    claim_amount: sumCharge(approvedBills),
    pending_amount: sumCharge(pendingBills),
    total_amount: sumCharge(bills),
  });
});

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

// CSV columns (kept in this exact order for round-trip import)
const CSV_HEADERS = [
  "Sr",
  "Branch Name",
  "Godown Name",
  "Bill No. & Date",
  "Commodity",
  "Period",
  "Amount Claimed",
  "GST tax",
  "Amount Passed",
  "Balance Amount",
  "Cheque No/RTGS & Date",
  "Advice No & Date",
  "Remarks",
] as const;

router.get("/v1/bills/export", authMiddleware, async (req, res): Promise<void> => {
  const { status, district, branch_name, financial_year, month_year, commodity_id, depositor_id, created_by } = req.query as Record<string, string>;

  let bills = await db.select().from(billsTable).orderBy(desc(billsTable.serial_no));

  if (req.user!.role === "operator") bills = bills.filter((b) => b.created_by === req.user!.id);
  if (status) bills = bills.filter((bill) => bill.status === status);
  if (district) bills = bills.filter((b) => b.district === district);
  if (branch_name) bills = bills.filter((bill) => bill.branch_name === branch_name);
  if (financial_year) bills = bills.filter((b) => b.financial_year === financial_year);
  if (month_year) bills = bills.filter((bill) => bill.month_year === month_year);
  if (commodity_id) bills = bills.filter((b) => b.commodity_id === parseInt(commodity_id, 10));
  if (depositor_id) bills = bills.filter((b) => b.depositor_id === parseInt(depositor_id, 10));
  if (created_by && req.user!.role === "admin") bills = bills.filter((b) => b.created_by === parseInt(created_by, 10));

  // Resolve commodity names in one query
  const commodityIds = Array.from(new Set(bills.map((b) => b.commodity_id)));
  const commodities = commodityIds.length
    ? await db.select().from(commoditiesTable)
    : [];
  const commodityById = new Map(commodities.map((c) => [c.id, c]));

  const csvRows: (string | number)[][] = [[...CSV_HEADERS]];

  for (const bill of bills) {
    const commodity = commodityById.get(bill.commodity_id);
    const commodityLabel = commodity ? `${commodity.crop_name} ${commodity.crop_year}` : "";
    const claimed = bill.total_charge != null ? parseFloat(bill.total_charge) : 0;
    const passed = bill.amount_passed != null ? parseFloat(bill.amount_passed) : null;
    const balance = passed != null ? (claimed - passed) : null;

    csvRows.push([
      bill.serial_no,
      bill.branch_name ?? "",
      bill.godown_name ?? "",
      joinNoAndDate(bill.bill_no, bill.billing_date),
      commodityLabel,
      bill.month_year ?? "",
      claimed ? claimed.toFixed(2) : "",
      bill.gst_tax != null ? parseFloat(bill.gst_tax).toFixed(2) : "",
      passed != null ? passed.toFixed(2) : "",
      balance != null ? balance.toFixed(2) : "",
      joinNoAndDate(bill.cheque_rtgs_no, bill.cheque_rtgs_date),
      joinNoAndDate(bill.advice_no, bill.advice_date),
      bill.remarks ?? "",
    ]);
  }

  res.header("Content-Type", "text/csv; charset=utf-8");
  res.attachment(`bills-${new Date().toISOString().split("T")[0]}.csv`);
  res.send(csvRows.map((row) => row.map(csvSafe).join(",")).join("\n"));
});

// CSV import — admin only. Updates payment-tracking fields on existing bills.
// Match by Sr (serial_no). Empty cells leave the existing value untouched.
router.post("/v1/bills/import", authMiddleware, csvUpload.single("file"), async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const text = req.file.buffer.toString("utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) { res.status(400).json({ error: "CSV is empty or missing data rows" }); return; }

  const header = rows[0].map((h) => h.trim());
  // Map header name -> column index for resilience to column reordering
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const cSr = idx("Sr");
  if (cSr < 0) { res.status(400).json({ error: "Missing required column 'Sr'" }); return; }
  const cGst = idx("GST tax");
  const cPassed = idx("Amount Passed");
  const cCheque = idx("Cheque No/RTGS & Date");
  const cAdvice = idx("Advice No & Date");
  const cRemarks = idx("Remarks");

  let updated = 0;
  const errors: { row: number; serial?: string; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const srRaw = (r[cSr] ?? "").trim();
    if (!srRaw) continue; // skip blank rows
    if (!/^\d+$/.test(srRaw)) {
      errors.push({ row: i + 1, serial: srRaw, reason: "Sr must be a positive integer" });
      continue;
    }
    const sr = parseInt(srRaw, 10);
    const [bill] = await db.select().from(billsTable).where(eq(billsTable.serial_no, sr));
    if (!bill) {
      errors.push({ row: i + 1, serial: srRaw, reason: "No bill found with this Sr" });
      continue;
    }

    const updates: Partial<typeof billsTable.$inferInsert> = {};

    if (cGst >= 0) {
      const v = (r[cGst] ?? "").trim();
      if (v) updates.gst_tax = parseNumber(v) ?? undefined;
    }
    if (cPassed >= 0) {
      const v = (r[cPassed] ?? "").trim();
      if (v) updates.amount_passed = parseNumber(v) ?? undefined;
    }
    if (cCheque >= 0) {
      const v = (r[cCheque] ?? "").trim();
      if (v) {
        const { no, date } = splitNoAndDate(v);
        if (no) updates.cheque_rtgs_no = no;
        if (date) updates.cheque_rtgs_date = date;
      }
    }
    if (cAdvice >= 0) {
      const v = (r[cAdvice] ?? "").trim();
      if (v) {
        const { no, date } = splitNoAndDate(v);
        if (no) updates.advice_no = no;
        if (date) updates.advice_date = date;
      }
    }
    if (cRemarks >= 0) {
      const v = (r[cRemarks] ?? "").trim();
      if (v) updates.remarks = v;
    }

    if (Object.keys(updates).length === 0) continue;

    await db.update(billsTable).set(updates).where(eq(billsTable.id, bill.id));
    updated++;
  }

  logger.info({ updated, errors: errors.length, by: req.user!.id }, "CSV import complete");
  res.json({
    updated,
    skipped: rows.length - 1 - updated - errors.length,
    errors,
  });
});

export default router;
