import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListCommodities, useCreateBill, useListDepositors, getListBillsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ArrowLeft, RefreshCw, Info } from "lucide-react";
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

function useCycleLookup(bill_no: string) {
  return useQuery({
    queryKey: ["cycle-lookup", bill_no],
    queryFn: async () => {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/bills/cycle-lookup?bill_no=${encodeURIComponent(bill_no)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json() as Promise<{
        found: boolean;
        closing_balance?: number | null;
        cycle?: number | null;
        serial_no?: number;
        month_year?: string | null;
      }>;
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

  // Cycle lookup for previous closing_balance
  const { data: cycleLookup } = useCycleLookup(form.bill_no);
  const [autoFilledOpening, setAutoFilledOpening] = useState(false);

  // Auto-fill district/branch from user profile
  useEffect(() => {
    if (isOperator && user) {
      setForm((prev) => ({
        ...prev,
        district: (user as any).district_name ?? prev.district,
        branch_name: (user as any).branch_name ? String((user as any).branch_name).toUpperCase() : prev.branch_name,
      }));
    }
  }, [user]);

  // Auto-fill crop_year and rate_per_bag from selected commodity
  useEffect(() => {
    const commodity = commodities.find((c) => c.id === parseInt(form.commodity_id));
    if (commodity) {
      setForm((prev) => ({
        ...prev,
        crop_year: commodity.crop_year ?? prev.crop_year,
        rate_per_bag: String(commodity.per_bag_per_month),
      }));
    }
  }, [form.commodity_id, commodities]);

  // Auto-fill opening_balance from previous cycle's closing_balance when bill_no matches
  useEffect(() => {
    if (cycleLookup?.found && cycleLookup.closing_balance != null && !autoFilledOpening) {
      setForm((prev) => ({ ...prev, opening_balance: String(cycleLookup.closing_balance) }));
      setAutoFilledOpening(true);
    }
    if (!cycleLookup?.found) {
      setAutoFilledOpening(false);
    }
  }, [cycleLookup]);

  const set = (field: keyof BillForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    let val = e.target.value;
    if (field === "branch_name") val = val.toUpperCase();
    if (field === "bill_no") setAutoFilledOpening(false);
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const cycle = form.billing_date ? cycleFromDate(form.billing_date) : null;
  const openingBal = parseInt(form.opening_balance) || 0;
  const receivedBags = parseInt(form.received_bags) || 0;
  const issueBags = parseInt(form.issue_bags) || 0;
  const reserveBags = parseInt(form.reserve_bags) || 0;

  // Chargeable Bags = Opening Balance
  const chargeableBags = openingBal;
  // Closing Balance = Opening Balance + Received Bags − Issue Bags + Reserve Bags
  const closingBal = openingBal + receivedBags - issueBags + reserveBags;

  const selectedCommodity = commodities.find((c) => c.id === parseInt(form.commodity_id));
  const selectedDepositor = depositors.find((d) => d.id === parseInt(form.depositor_id));

  // Total Charge = Chargeable Bags × Rate ÷ 2
  const ratePerBag = parseFloat(form.rate_per_bag) || 0;
  const totalCharge = chargeableBags * ratePerBag / 2;
  const gstAmount = selectedDepositor?.total_gst != null
    ? totalCharge * selectedDepositor.total_gst / 100
    : null;
  const grandTotal = gstAmount != null ? totalCharge + gstAmount : totalCharge;
  const showChargeSummary = selectedCommodity != null && (chargeableBags > 0 || ratePerBag > 0);

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

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
  const lockedClass = "w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground cursor-not-allowed";
  const derivedClass = "w-full px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-sm font-medium text-amber-900 cursor-default";

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

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">

          {/* ── Billing Date & Cycle ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Billing Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={form.billing_date}
                onChange={set("billing_date")}
                required
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-detected to today. Change if needed.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Billing Cycle</label>
              <div className={`${derivedClass} flex items-center gap-2`}>
                {cycle !== null ? (
                  <>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      cycle === 1
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-purple-100 text-purple-800 border border-purple-200"
                    }`}>
                      Cycle {cycle}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cycle === 1 ? "1st–15th of month" : "16th–31st of month"}
                    </span>
                  </>
                ) : "—"}
              </div>
            </div>
          </div>

          {/* ── Commodity & Depositor ─────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Commodity <span className="text-destructive">*</span></label>
            <select value={form.commodity_id} onChange={set("commodity_id")} required className={inputClass}>
              <option value="">Select commodity...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.crop_name} — {c.crop_year} (₹{c.per_bag_per_month}/bag/month)</option>
              ))}
            </select>
            {form.commodity_id && (
              <p className="text-xs text-muted-foreground mt-1">Crop year and rate/bag auto-filled from selected commodity.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Depositor</label>
            <select value={form.depositor_id} onChange={set("depositor_id")} className={inputClass}>
              <option value="">Select depositor...</option>
              {depositors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.gst_no ? ` (${d.gst_no})` : ""}{d.total_gst != null ? ` — GST ${d.total_gst}%` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* ── Bill Details ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bill No</label>
              <input
                value={form.bill_no}
                onChange={set("bill_no")}
                placeholder="e.g. BPL-001"
                className={inputClass}
              />
              {/* Previous cycle info banner */}
              {cycleLookup?.found && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-green-700">
                    Previous cycle found (Cycle {cycleLookup.cycle}, {cycleLookup.month_year}, Serial #{cycleLookup.serial_no}).
                    {" "}Opening balance auto-filled from closing balance: <strong>{cycleLookup.closing_balance}</strong> bags.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">District</label>
              {isOperator ? (
                <div className={lockedClass}>{form.district || "—"}</div>
              ) : (
                <SearchableSelect options={MP_DISTRICTS} value={form.district}
                  onChange={(v) => setForm((prev) => ({ ...prev, district: v }))} placeholder="Select district..." />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Branch Name</label>
              {isOperator ? (
                <div className={lockedClass}>{form.branch_name || "—"}</div>
              ) : (
                <input value={form.branch_name} onChange={set("branch_name")} placeholder="BRANCH NAME (uppercase)" className={inputClass + " uppercase"} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Godown Name</label>
              <input value={form.godown_name} onChange={set("godown_name")} placeholder="Godown name" className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Crop Year</label>
              <input value={form.crop_year} onChange={set("crop_year")} placeholder="e.g. 2024-25"
                className={inputClass + (form.commodity_id ? " bg-muted/30" : "")} />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Financial Year</label>
              <select value={form.financial_year} onChange={set("financial_year")} className={inputClass}>
                <option value="">Select financial year...</option>
                {FY_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Rate Per Bag (₹)</label>
              <input type="number" step="0.01" value={form.rate_per_bag} onChange={set("rate_per_bag")} placeholder="0.00"
                className={inputClass + (form.commodity_id ? " bg-muted/30" : "")} />
            </div>

            <div>
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
              {form.month && form.month_year_year && (
                <p className="text-xs text-muted-foreground mt-1">
                  Saved as: <strong>{joinMonthYear(form.month, form.month_year_year)}</strong>
                </p>
              )}
            </div>
          </div>

          {/* ── Bag Quantities ────────────────────────────────────────────── */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-1">Bag Quantities</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Chargeable Bags and Closing Balance are auto-calculated.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {/* Opening Balance — input, may be auto-filled */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Opening Balance
                  {autoFilledOpening && (
                    <span className="ml-1 text-xs text-green-600 font-normal">auto-filled</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.opening_balance}
                    onChange={set("opening_balance")}
                    placeholder="0"
                    min="0"
                    className={inputClass + (autoFilledOpening ? " border-green-300 bg-green-50/50" : "")}
                  />
                  {autoFilledOpening && (
                    <button
                      type="button"
                      title="Re-fetch from previous cycle"
                      onClick={() => {
                        setAutoFilledOpening(false);
                        if (cycleLookup?.found && cycleLookup.closing_balance != null) {
                          setForm((p) => ({ ...p, opening_balance: String(cycleLookup.closing_balance) }));
                          setAutoFilledOpening(true);
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-800"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Received Bags</label>
                <input type="number" value={form.received_bags} onChange={set("received_bags")} placeholder="0" min="0" className={inputClass} />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Issue Bags</label>
                <input type="number" value={form.issue_bags} onChange={set("issue_bags")} placeholder="0" min="0" className={inputClass} />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Reserve Bags</label>
                <input type="number" value={form.reserve_bags} onChange={set("reserve_bags")} placeholder="0" min="0" className={inputClass} />
              </div>

              {/* Chargeable Bags — auto = Opening Balance */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Chargeable Bags
                  <span className="ml-1 text-xs text-amber-600 font-normal">= Opening Balance</span>
                </label>
                <div className={derivedClass}>{chargeableBags}</div>
              </div>

              {/* Closing Balance — auto-computed */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Closing Balance
                  <span className="ml-1 text-xs text-amber-600 font-normal">auto-computed</span>
                </label>
                <div className={derivedClass}>{closingBal}</div>
                <p className="text-xs text-muted-foreground mt-1">= Ob + Rcv − Issue + Reserve</p>
              </div>
            </div>
          </div>

          {/* ── Charge Summary ────────────────────────────────────────────── */}
          {showChargeSummary && (
            <div className="border-t border-border pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground mb-3">Charge Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Total Charge (₹)</label>
                  <div className={derivedClass}>₹{totalCharge.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Chargeable Bags × rate ÷ 2</p>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    GST {selectedDepositor?.total_gst != null ? `(${selectedDepositor.total_gst}%)` : ""} (₹)
                  </label>
                  <div className={derivedClass}>
                    {gstAmount != null ? `₹${gstAmount.toFixed(2)}` : (form.depositor_id ? "—" : "Select depositor")}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Grand Total (₹)</label>
                  <div className={`${derivedClass} text-green-800 font-bold`}>
                    ₹{grandTotal.toFixed(2)}
                  </div>
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
