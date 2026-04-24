import { Router } from "express";
import { db, billsTable, commoditiesTable, depositorsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import * as XLSX from "xlsx";

const router = Router();

router.get("/v1/reports/bills-excel", authMiddleware, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const {
    commodity_id,
    depositor_id,
    district,
    branch_name,
    financial_year,
    month_year,
    scheme,
    regional_office,
  } = req.query as Record<string, string>;

  const allBills = await db.select().from(billsTable).orderBy(desc(billsTable.created_at));
  const commodities = await db.select().from(commoditiesTable);
  const depositors = await db.select().from(depositorsTable);
  const cMap = new Map(commodities.map((c) => [c.id, c]));
  const dMap = new Map(depositors.map((d) => [d.id, d]));

  let bills = allBills.filter((b) => b.status === "approved");
  if (commodity_id) bills = bills.filter((b) => b.commodity_id === parseInt(commodity_id, 10));
  if (depositor_id) bills = bills.filter((b) => b.depositor_id === parseInt(depositor_id, 10));
  if (district) bills = bills.filter((b) => b.district === district);
  if (branch_name) bills = bills.filter((b) => b.branch_name === branch_name);
  if (financial_year) bills = bills.filter((b) => b.financial_year === financial_year);
  if (month_year) bills = bills.filter((b) => b.month_year === month_year);

  const schemeLabel = scheme && scheme.trim() ? scheme.trim() : "PSS";
  const regionLabel = regional_office && regional_office.trim() ? regional_office.trim() : "";

  // Sort for grouping by month_year, then by district/branch for stable order
  bills.sort((a, b) => {
    const ma = a.month_year ?? "";
    const mb = b.month_year ?? "";
    if (ma !== mb) return ma.localeCompare(mb);
    const da = a.district ?? "";
    const db_ = b.district ?? "";
    if (da !== db_) return da.localeCompare(db_);
    return (a.branch_name ?? "").localeCompare(b.branch_name ?? "");
  });

  // Build rows
  type Row = (string | number | null)[];
  const headerCols = [
    "S. No.",
    "Regional Office",
    "District",
    "Branch",
    "Godown Name",
    "SCHEME",
    "COMMODITY",
    "CROP YEAR",
    "BILL NO",
    "DATE",
    "Bill MONTH",
    "Rate per Bag",
    "BAGS (1 TO 15 DAYS)",
    "AMOUNT (1 TO 15 DAYS)",
    "BAGS (16 TO 31 DAYS)",
    "AMOUNT (16 TO 31 DAYS)",
    "CL.BAG",
    "Bill Amount",
  ];

  // Title row description
  let titleParts: string[] = [];
  const commodityName = commodity_id ? cMap.get(parseInt(commodity_id, 10))?.crop_name : "";
  const depositorName = depositor_id ? dMap.get(parseInt(depositor_id, 10))?.name : "";
  if (month_year) titleParts.push(`Month: ${month_year}`);
  if (financial_year) titleParts.push(`FY: ${financial_year}`);
  if (commodityName) titleParts.push(`Commodity: ${commodityName}`);
  if (depositorName) titleParts.push(`Depositor: ${depositorName}`);
  if (district) titleParts.push(`District: ${district}`);
  if (branch_name) titleParts.push(`Branch: ${branch_name}`);
  titleParts.push(`Scheme: ${schemeLabel}`);
  const title = `Storage Bill Details — ${titleParts.join(" | ")}`;

  const rows: Row[] = [];
  rows.push([title, ...new Array(headerCols.length - 1).fill("")]);
  rows.push(headerCols);

  const fmtDate = (d: Date | string | null): string => {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dt.getTime())) return "";
    const day = String(dt.getDate()).padStart(2, "0");
    const mon = String(dt.getMonth() + 1).padStart(2, "0");
    return `${day}-${mon}-${dt.getFullYear()}`;
  };

  let serial = 0;
  let monthSubtotal = 0;
  let grandTotal = 0;
  let currentMonth: string | null = null;

  const flushMonthSubtotal = () => {
    if (currentMonth != null) {
      const subRow: Row = new Array(headerCols.length).fill("");
      subRow[0] = `Subtotal: ${currentMonth || "(no month)"}`;
      subRow[headerCols.length - 1] = +monthSubtotal.toFixed(2);
      rows.push(subRow);
    }
  };

  for (const b of bills) {
    if (currentMonth !== b.month_year) {
      flushMonthSubtotal();
      currentMonth = b.month_year ?? "";
      monthSubtotal = 0;
    }
    serial += 1;
    const commodity = cMap.get(b.commodity_id);
    const rate = b.rate_per_bag != null ? parseFloat(b.rate_per_bag) : (commodity ? parseFloat(commodity.per_bag_per_month) : 0);
    const totalCharge = b.total_charge != null ? parseFloat(b.total_charge) : 0;
    const bags = b.chargeable_bags ?? 0;
    const isCycle1 = b.cycle === 1;
    const bags1 = isCycle1 ? bags : 0;
    const amount1 = isCycle1 ? totalCharge : 0;
    const bags2 = !isCycle1 ? bags : 0;
    const amount2 = !isCycle1 ? totalCharge : 0;
    const cropYear = commodity ? `${commodity.crop_name} ${commodity.crop_year}` : (b.crop_year ?? "");

    rows.push([
      serial,
      regionLabel,
      b.district ?? "",
      b.branch_name ?? "",
      b.godown_name ?? "",
      schemeLabel,
      cropYear,
      b.crop_year ?? (commodity?.crop_year ?? ""),
      b.bill_no ?? "",
      fmtDate(b.billing_date),
      b.month_year ?? "",
      +rate.toFixed(2),
      bags1,
      +amount1.toFixed(2),
      bags2,
      +amount2.toFixed(2),
      b.closing_balance ?? 0,
      +totalCharge.toFixed(2),
    ]);

    monthSubtotal += totalCharge;
    grandTotal += totalCharge;
  }
  flushMonthSubtotal();

  const totalRow: Row = new Array(headerCols.length).fill("");
  totalRow[0] = "TOTAL";
  totalRow[headerCols.length - 1] = +grandTotal.toFixed(2);
  rows.push(totalRow);

  // Build sheet
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Merge title row across all columns
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headerCols.length - 1 } }];
  // Column widths (rough)
  ws["!cols"] = [
    { wch: 7 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 28 },
    { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 22 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 10 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Storage Bills Report");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `MPWLC_Storage_Bills_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
});

export default router;
