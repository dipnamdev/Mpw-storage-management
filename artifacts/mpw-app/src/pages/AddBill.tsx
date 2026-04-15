import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListCommodities, useCreateBill, useListDepositors, getListBillsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ArrowLeft, Link2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { MONTH_SHORT, MONTH_FULL, getFinancialYearOptions, getYearOptions, joinMonthYear } from "@/lib/date-options";
import { MP_DISTRICTS } from "@/lib/districts";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const FY_OPTIONS = getFinancialYearOptions();
const YEAR_OPTIONS = getYearOptions();

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function cycleFromDate(dateStr: string): 1 | 2 {
  const day = new Date(dateStr).getDate();
  return day <= 15 ? 1 : 2;
}

interface PrevBill {
  found: boolean;
  closing_balance?: number | null;
  cycle?: number | null;
  serial_no?: number;
  month_year?: string | null;
  district?: string | null;
  branch_name?: string | null;
  godown_name?: string | null;
  commodity_id?: number | null;
  depositor_id?: number | null;
  crop_year?: string | null;
  financial_year?: string | null;
  rate_per_bag?: string | null;
}

function useCycleLookup(bill_no: string) {
  return useQuery<PrevBill>({
    queryKey: ["cycle-lookup", bill_no],
    queryFn: async () => {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/bills/cycle-lookup?bill_no=${encodeURIComponent(bill_no)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: bill_no.trim().length > 0,
    staleTime: 10_000,
  });
}

interface BillForm {
  billing_date: string;
  district: string;
  branch_name: string;
  godown_name: string;
  bill_no: string;
  commodity_id: string;
  depositor_id: string;
  crop_year: string;
  financial_year: string;
  month: string;
  month_year_year: string;
  rate_per_bag: string;
  opening_balance: string;
  received_bags: string;
  issue_bags: string;
  reserve_bags: string;
}

export default function AddBillPage() {
  const { user } = useAuth();
  const isOperator = user?.role === "operator";

  const [form, setForm] = useState<BillForm>({
    billing_date: todayISO(),
    district: (user as any)?.district_name ?? "",
    branch_name: (user as any)?.branch_name ? String((user as any).branch_name).toUpperCase() : "",
    godown_name: "",
    bill_no: "",
    commodity_id: "",
    depositor_id: "",
    crop_year: "",
    financial_year: "",
    month: "",
    month_year_year: String(new Date().getFullYear()),
    rate_per_bag: "",
    opening_balance: "",
    received_bags: "",
    issue_bags: "",
    reserve_bags: "",
  });

  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: commodities = [] } = useListCommodities();
  const { data: depositors = [] } = useListDepositors();
  const createBill = useCreateBill();

  const { data: prevBill } = useCycleLookup(form.bill_no);
  const billLinked = prevBill?.found === true;

  // Sync district/branch from user profile (operator)
  useEffect(() => {
    if (isOperator && user) {
      setForm((prev) => ({
        ...prev,
        district: (user as any).district_name ?? prev.district,
        branch_name: (user as any).branch_name
          ? String((user as any).branch_name).toUpperCase()
          : prev.branch_name,
      }));
    }
  }, [user]);

  // Auto-fill crop_year and rate_per_bag from commodity (only when NOT bill-linked)
  useEffect(() => {
    if (billLinked) return;
    const commodity = commodities.find((c) => c.id === parseInt(form.commodity_id));
    if (commodity) {
      setForm((prev) => ({
        ...prev,
        crop_year: commodity.crop_year ?? prev.crop_year,
        rate_per_bag: String(commodity.per_bag_per_month),
      }));
    }
  }, [form.commodity_id, commodities, billLinked]);

  // When bill_no resolves to a previous bill → lock & auto-fill everything
  useEffect(() => {
    if (!prevBill?.found) return;
    const p = prevBill;
    setForm((prev) => ({
      ...prev,
      district: p.district ?? prev.district,
      branch_name: p.branch_name ?? prev.branch_name,
      godown_name: p.godown_name ?? prev.godown_name,
      commodity_id: p.commodity_id != null ? String(p.commodity_id) : prev.commodity_id,
      depositor_id: p.depositor_id != null ? String(p.depositor_id) : prev.depositor_id,
      crop_year: p.crop_year ?? prev.crop_year,
      financial_year: p.financial_year ?? prev.financial_year,
      rate_per_bag: p.rate_per_bag ?? prev.rate_per_bag,
      opening_balance: p.closing_balance != null ? String(p.closing_balance) : prev.opening_balance,
    }));
  }, [prevBill]);

  const set = (field: keyof BillForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Derived ────────────────────────────────────────────────────────────────
  const cycle = form.billing_date ? cycleFromDate(form.billing_date) : null;
  const openingBal   = parseInt(form.opening_balance)  || 0;
  const receivedBags = parseInt(form.received_bags)    || 0;
  const issueBags    = parseInt(form.issue_bags)       || 0;
  const reserveBags  = parseInt(form.reserve_bags)     || 0;
  const chargeableBags = openingBal;
  const closingBal     = openingBal + receivedBags - issueBags + reserveBags;

  const selectedCommodity = commodities.find((c) => c.id === parseInt(form.commodity_id));
  const selectedDepositor = depositors.find((d) => d.id === parseInt(form.depositor_id));
  const ratePerBag    = parseFloat(form.rate_per_bag) || 0;
  const totalCharge   = chargeableBags * ratePerBag / 2;
  const gstAmount     = selectedDepositor?.total_gst != null
    ? totalCharge * selectedDepositor.total_gst / 100
    : null;
  const grandTotal    = gstAmount != null ? totalCharge + gstAmount : totalCharge;
  const showSummary   = selectedCommodity != null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.commodity_id) { setError("Please select a commodity"); return; }
    if (!form.billing_date) { setError("Billing date is required"); return; }

    const month_year = joinMonthYear(form.month, form.month_year_year);
    try {
      const result = await createBill.mutateAsync({
        data: {
          billing_date: form.billing_date,
          district: form.district || undefined,
          branch_name: form.branch_name || undefined,
          godown_name: form.godown_name || undefined,
          bill_no: form.bill_no || undefined,
          commodity_id: parseInt(form.commodity_id),
          depositor_id: form.depositor_id ? parseInt(form.depositor_id) : undefined,
          crop_year: form.crop_year || undefined,
          financial_year: form.financial_year || undefined,
          month_year: month_year || undefined,
          rate_per_bag: form.rate_per_bag ? parseFloat(form.rate_per_bag) : undefined,
          opening_balance: openingBal,
          received_bags: receivedBags,
          issue_bags: issueBags,
          reserve_bags: reserveBags,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
      toast({ title: "Bill submitted successfully", description: "Your bill has been submitted and is pending admin review." });
      navigate(`/bills/${result.id}`);
    } catch {
      setError("Failed to create bill. Please check all fields.");
    }
  };

  // CSS helpers
  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
  const lockedClass = "w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground cursor-not-allowed select-none";
  const derivedClass = "w-full px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/60 text-sm font-medium text-amber-900 cursor-default select-none";

  // Which fields are locked because bill_no is linked to a previous bill
  const linked = billLinked;

  return (
    <Layout>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/bills">
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Add New Bill</h1>
        </div>

        {isOperator && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            Your district and branch are pre-filled from your account and cannot be changed.
          </div>
        )}

        {linked && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Linked to previous cycle — Serial #{prevBill?.serial_no}, Cycle {prevBill?.cycle} ({prevBill?.month_year}).
              All details are carried forward. Only Received Bags, Issue Bags, Reserve Bags, and Month-Year can be changed.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">

          {/* ── Billing Date & Cycle ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Billing Date <span className="text-destructive">*</span>
              </label>
              <input type="date" value={form.billing_date} onChange={set("billing_date")} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Billing Cycle</label>
              <div className={derivedClass + " flex items-center gap-2"}>
                {cycle !== null ? (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    cycle === 1
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : "bg-purple-100 text-purple-800 border border-purple-200"
                  }`}>
                    Cycle {cycle} — {cycle === 1 ? "1st–15th" : "16th–31st"}
                  </span>
                ) : "—"}
              </div>
            </div>
          </div>

          {/* ── Bill No ──────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Bill No</label>
            <input
              value={form.bill_no}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, bill_no: e.target.value }));
              }}
              placeholder="e.g. BPL-001"
              className={inputClass}
            />
          </div>

          {/* ── Commodity ────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Commodity <span className="text-destructive">*</span></label>
            {linked ? (
              <div className={lockedClass}>{selectedCommodity ? `${selectedCommodity.crop_name} — ${selectedCommodity.crop_year}` : form.commodity_id || "—"}</div>
            ) : (
              <select value={form.commodity_id} onChange={set("commodity_id")} required className={inputClass}>
                <option value="">Select commodity...</option>
                {commodities.map((c) => (
                  <option key={c.id} value={c.id}>{c.crop_name} — {c.crop_year} (₹{c.per_bag_per_month}/bag/month)</option>
                ))}
              </select>
            )}
          </div>

          {/* ── Depositor ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Depositor</label>
            {linked ? (
              <div className={lockedClass}>
                {selectedDepositor
                  ? `${selectedDepositor.name}${selectedDepositor.gst_no ? ` (${selectedDepositor.gst_no})` : ""}`
                  : "—"}
              </div>
            ) : (
              <select value={form.depositor_id} onChange={set("depositor_id")} className={inputClass}>
                <option value="">Select depositor...</option>
                {depositors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.gst_no ? ` (${d.gst_no})` : ""}{d.total_gst != null ? ` — GST ${d.total_gst}%` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ── Details Grid ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">District</label>
              {isOperator || linked ? (
                <div className={lockedClass}>{form.district || "—"}</div>
              ) : (
                <SearchableSelect options={MP_DISTRICTS} value={form.district}
                  onChange={(v) => setForm((prev) => ({ ...prev, district: v }))} placeholder="Select district..." />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Branch Name</label>
              {isOperator || linked ? (
                <div className={lockedClass}>{form.branch_name || "—"}</div>
              ) : (
                <input value={form.branch_name} onChange={set("branch_name")} placeholder="BRANCH NAME" className={inputClass + " uppercase"} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Godown Name</label>
              {linked ? (
                <div className={lockedClass}>{form.godown_name || "—"}</div>
              ) : (
                <input value={form.godown_name} onChange={set("godown_name")} placeholder="Godown name" className={inputClass} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Crop Year</label>
              {linked ? (
                <div className={lockedClass}>{form.crop_year || "—"}</div>
              ) : (
                <input value={form.crop_year} onChange={set("crop_year")} placeholder="e.g. 2024-25"
                  className={inputClass + (form.commodity_id ? " bg-muted/30" : "")} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Financial Year</label>
              {linked ? (
                <div className={lockedClass}>{form.financial_year || "—"}</div>
              ) : (
                <select value={form.financial_year} onChange={set("financial_year")} className={inputClass}>
                  <option value="">Select financial year...</option>
                  {FY_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>

            {/* Rate Per Bag — always locked (derived from commodity) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Rate Per Bag (₹)</label>
              <div className={lockedClass}>{form.rate_per_bag ? `₹${form.rate_per_bag}` : "—"}</div>
            </div>

            {/* Month-Year — always editable */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Month-Year</label>
              <div className="flex gap-2">
                <select value={form.month} onChange={set("month")} className={inputClass}>
                  <option value="">Select Month</option>
                  {MONTH_SHORT.map((short, i) => (
                    <option key={short} value={short}>{MONTH_FULL[i]}</option>
                  ))}
                </select>
                <select value={form.month_year_year} onChange={set("month_year_year")} className={inputClass}>
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Bag Quantities ────────────────────────────────────────────── */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Bag Quantities</h3>
            <div className="grid grid-cols-3 gap-4">

              {/* Opening Balance — locked (auto-filled from previous closing balance, or manual for first bill) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Opening Balance</label>
                {linked ? (
                  <div className={lockedClass}>{form.opening_balance || "0"}</div>
                ) : (
                  <input type="number" value={form.opening_balance} onChange={set("opening_balance")} placeholder="0" min="0" className={inputClass} />
                )}
              </div>

              {/* Received Bags — always editable */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Received Bags</label>
                <input type="number" value={form.received_bags} onChange={set("received_bags")} placeholder="0" min="0" className={inputClass} />
              </div>

              {/* Issue Bags — always editable */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Issue Bags</label>
                <input type="number" value={form.issue_bags} onChange={set("issue_bags")} placeholder="0" min="0" className={inputClass} />
              </div>

              {/* Reserve Bags — always editable */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Reserve Bags</label>
                <input type="number" value={form.reserve_bags} onChange={set("reserve_bags")} placeholder="0" min="0" className={inputClass} />
              </div>

              {/* Chargeable Bags — derived = Opening Balance */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Chargeable Bags</label>
                <div className={derivedClass}>{chargeableBags}</div>
              </div>

              {/* Closing Balance — derived */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Closing Balance</label>
                <div className={derivedClass}>{closingBal}</div>
              </div>
            </div>
          </div>

          {/* ── Charge Summary ────────────────────────────────────────────── */}
          {showSummary && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Charge Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Total Charge (₹)</label>
                  <div className={derivedClass}>₹{totalCharge.toFixed(2)}</div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    GST {selectedDepositor?.total_gst != null ? `(${selectedDepositor.total_gst}%)` : ""} (₹)
                  </label>
                  <div className={derivedClass}>
                    {gstAmount != null ? `₹${gstAmount.toFixed(2)}` : "—"}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Grand Total (₹)</label>
                  <div className={`${derivedClass} text-green-800 font-bold`}>₹{grandTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createBill.isPending}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {createBill.isPending ? "Submitting..." : "Submit Bill"}
            </button>
            <Link href="/bills">
              <button type="button" className="px-6 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
