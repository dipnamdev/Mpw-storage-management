import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListCommodities, useCreateBill, useListDepositors, getListBillsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { MONTH_NAMES, getFinancialYearOptions, getYearOptions, joinMonthYear } from "@/lib/date-options";
import { MP_DISTRICTS } from "@/lib/districts";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/lib/auth";

const FY_OPTIONS = getFinancialYearOptions();
const YEAR_OPTIONS = getYearOptions();

interface BillForm {
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
  closing_balance: string;
  reserve_bags: string;
  chargeable_bags: string;
}

export default function AddBillPage() {
  const { user } = useAuth();
  const isOperator = user?.role === "operator";

  const [form, setForm] = useState<BillForm>({
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
    closing_balance: "",
    reserve_bags: "",
    chargeable_bags: "",
  });

  const [totalCharge, setTotalCharge] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: commodities = [] } = useListCommodities();
  const { data: depositors = [] } = useListDepositors();
  const createBill = useCreateBill();

  // When user profile loads, update district/branch
  useEffect(() => {
    if (isOperator && user) {
      setForm((prev) => ({
        ...prev,
        district: (user as any).district_name ?? prev.district,
        branch_name: (user as any).branch_name ? String((user as any).branch_name).toUpperCase() : prev.branch_name,
      }));
    }
  }, [user]);

  // Auto-fill crop_year and rate_per_bag when commodity changes
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

  // Auto-calculate total charge
  useEffect(() => {
    const commodity = commodities.find((c) => c.id === parseInt(form.commodity_id));
    const received = parseInt(form.received_bags);
    if (commodity && !isNaN(received)) {
      setTotalCharge((received * commodity.per_bag_per_month) / 2);
    } else {
      setTotalCharge(null);
    }
  }, [form.commodity_id, form.received_bags, commodities]);

  const set = (field: keyof BillForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    let val = e.target.value;
    if (field === "branch_name") val = val.toUpperCase();
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.commodity_id) { setError("Please select a commodity"); return; }

    const month_year = joinMonthYear(form.month, form.month_year_year);

    try {
      const result = await createBill.mutateAsync({
        data: {
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
          opening_balance: form.opening_balance ? parseInt(form.opening_balance) : undefined,
          received_bags: form.received_bags ? parseInt(form.received_bags) : undefined,
          issue_bags: form.issue_bags ? parseInt(form.issue_bags) : undefined,
          closing_balance: form.closing_balance ? parseInt(form.closing_balance) : undefined,
          reserve_bags: form.reserve_bags ? parseInt(form.reserve_bags) : undefined,
          chargeable_bags: form.chargeable_bags ? parseInt(form.chargeable_bags) : undefined,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
      navigate(`/bills/${result.id}`);
    } catch {
      setError("Failed to create bill. Please check all fields.");
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
  const lockedClass = "w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground cursor-not-allowed";

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
            Your district and branch are pre-filled from your account profile and cannot be changed.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">

          {/* Commodity */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Commodity *</label>
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

          {/* Depositor */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Depositor</label>
            <select value={form.depositor_id} onChange={set("depositor_id")} className={inputClass}>
              <option value="">Select depositor...</option>
              {depositors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.gst_no ? ` (${d.gst_no})` : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bill No</label>
              <input value={form.bill_no} onChange={set("bill_no")} placeholder="e.g. BPL-001" className={inputClass} />
            </div>

            {/* District — searchable, locked for operators */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">District</label>
              {isOperator ? (
                <div className={lockedClass}>{form.district || "—"}</div>
              ) : (
                <SearchableSelect
                  options={MP_DISTRICTS}
                  value={form.district}
                  onChange={(v) => setForm((prev) => ({ ...prev, district: v }))}
                  placeholder="Select district..."
                />
              )}
            </div>

            {/* Branch — locked for operators */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Branch Name</label>
              {isOperator ? (
                <div className={lockedClass}>{form.branch_name || "—"}</div>
              ) : (
                <input
                  value={form.branch_name}
                  onChange={set("branch_name")}
                  placeholder="BRANCH NAME (uppercase)"
                  className={inputClass + " uppercase"}
                />
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
                  <option value="">Month</option>
                  {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={form.month_year_year} onChange={set("month_year_year")} className={inputClass}>
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {form.month && form.month_year_year && (
                <p className="text-xs text-muted-foreground mt-1">
                  Will be saved as: <strong>{joinMonthYear(form.month, form.month_year_year)}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Bag Quantities */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Bag Quantities</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { field: "opening_balance" as keyof BillForm, label: "Opening Balance" },
                { field: "received_bags" as keyof BillForm, label: "Received Bags" },
                { field: "issue_bags" as keyof BillForm, label: "Issue Bags" },
                { field: "closing_balance" as keyof BillForm, label: "Closing Balance" },
                { field: "reserve_bags" as keyof BillForm, label: "Reserve Bags" },
                { field: "chargeable_bags" as keyof BillForm, label: "Chargeable Bags" },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
                  <input type="number" value={form[field]} onChange={set(field)} placeholder="0" min="0" className={inputClass} />
                </div>
              ))}
            </div>
          </div>

          {totalCharge !== null && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-700">
                <span className="font-medium">Calculated Total Charge: </span>
                ₹{totalCharge.toFixed(2)}
                <span className="text-xs ml-2 opacity-70">(received_bags × per_bag_per_month ÷ 2)</span>
              </div>
            </div>
          )}

          {error && <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createBill.isPending}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
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
