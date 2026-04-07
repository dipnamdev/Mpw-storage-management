import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetBill, useListCommodities, useRequestBillEdit, getGetBillQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MONTH_NAMES, getFinancialYearOptions, getYearOptions, joinMonthYear, splitMonthYear } from "@/lib/date-options";

const FY_OPTIONS = getFinancialYearOptions();
const YEAR_OPTIONS = getYearOptions();

export default function RequestEditPage() {
  const [, params] = useRoute("/bills/:id/request-edit");
  const id = params?.id ? parseInt(params.id) : 0;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: bill, isLoading } = useGetBill(id, { query: { enabled: !!id } });
  const { data: commodities = [] } = useListCommodities();
  const editMutation = useRequestBillEdit();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    district: "",
    branch_name: "",
    godown_name: "",
    bill_no: "",
    commodity_id: "",
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

  useEffect(() => {
    if (bill) {
      const { month, year } = splitMonthYear(bill.month_year ?? "");
      setForm({
        district: bill.district ?? "",
        branch_name: bill.branch_name ?? "",
        godown_name: bill.godown_name ?? "",
        bill_no: bill.bill_no ?? "",
        commodity_id: String(bill.commodity_id),
        crop_year: bill.crop_year ?? "",
        financial_year: bill.financial_year ?? "",
        month: month,
        month_year_year: year || String(new Date().getFullYear()),
        rate_per_bag: bill.rate_per_bag != null ? String(bill.rate_per_bag) : "",
        opening_balance: bill.opening_balance != null ? String(bill.opening_balance) : "",
        received_bags: bill.received_bags != null ? String(bill.received_bags) : "",
        issue_bags: bill.issue_bags != null ? String(bill.issue_bags) : "",
        closing_balance: bill.closing_balance != null ? String(bill.closing_balance) : "",
        reserve_bags: bill.reserve_bags != null ? String(bill.reserve_bags) : "",
        chargeable_bags: bill.chargeable_bags != null ? String(bill.chargeable_bags) : "",
      });
    }
  }, [bill]);

  useEffect(() => {
    const commodity = commodities.find((c) => c.id === parseInt(form.commodity_id));
    if (commodity && form.commodity_id !== String(bill?.commodity_id)) {
      setForm((prev) => ({
        ...prev,
        crop_year: commodity.crop_year ?? prev.crop_year,
        rate_per_bag: String(commodity.per_bag_per_month),
      }));
    }
  }, [form.commodity_id, commodities]);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const month_year = joinMonthYear(form.month, form.month_year_year);
    const changes: Record<string, unknown> = {};

    if (form.district !== (bill?.district ?? "")) changes.district = form.district;
    if (form.branch_name !== (bill?.branch_name ?? "")) changes.branch_name = form.branch_name;
    if (form.godown_name !== (bill?.godown_name ?? "")) changes.godown_name = form.godown_name;
    if (form.bill_no !== (bill?.bill_no ?? "")) changes.bill_no = form.bill_no;
    if (form.crop_year !== (bill?.crop_year ?? "")) changes.crop_year = form.crop_year;
    if (form.financial_year !== (bill?.financial_year ?? "")) changes.financial_year = form.financial_year;
    if (month_year !== (bill?.month_year ?? "")) changes.month_year = month_year;
    if (form.rate_per_bag !== String(bill?.rate_per_bag ?? "")) changes.rate_per_bag = parseFloat(form.rate_per_bag);
    if (form.opening_balance !== String(bill?.opening_balance ?? "")) changes.opening_balance = parseInt(form.opening_balance);
    if (form.received_bags !== String(bill?.received_bags ?? "")) changes.received_bags = parseInt(form.received_bags);
    if (form.issue_bags !== String(bill?.issue_bags ?? "")) changes.issue_bags = parseInt(form.issue_bags);
    if (form.closing_balance !== String(bill?.closing_balance ?? "")) changes.closing_balance = parseInt(form.closing_balance);
    if (form.reserve_bags !== String(bill?.reserve_bags ?? "")) changes.reserve_bags = parseInt(form.reserve_bags);
    if (form.chargeable_bags !== String(bill?.chargeable_bags ?? "")) changes.chargeable_bags = parseInt(form.chargeable_bags);

    if (Object.keys(changes).length === 0) { setError("No changes detected"); return; }

    try {
      await editMutation.mutateAsync({ id, data: changes as any });
      queryClient.invalidateQueries({ queryKey: getGetBillQueryKey(id) });
      navigate(`/bills/${id}`);
    } catch {
      setError("Failed to submit edit request");
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
  const selectClass = inputClass;

  if (isLoading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/bills/${id}`}>
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Request Edit — Bill #{bill?.serial_no}</h1>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
          Changes will be submitted as an edit request and require admin approval before being applied.
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">

          {/* Commodity */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Commodity</label>
            <select value={form.commodity_id} onChange={set("commodity_id")} className={selectClass}>
              <option value="">Select commodity...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.crop_name} — {c.crop_year} (₹{c.per_bag_per_month}/bag/month)</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bill No</label>
              <input value={form.bill_no} onChange={set("bill_no")} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">District</label>
              <input value={form.district} onChange={set("district")} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Branch Name</label>
              <input value={form.branch_name} onChange={set("branch_name")} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Godown Name</label>
              <input value={form.godown_name} onChange={set("godown_name")} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Crop Year</label>
              <input value={form.crop_year} onChange={set("crop_year")} placeholder="e.g. 2024-25" className={inputClass} />
            </div>

            {/* Financial Year — dropdown */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Financial Year</label>
              <select value={form.financial_year} onChange={set("financial_year")} className={selectClass}>
                <option value="">Select financial year...</option>
                {FY_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Rate Per Bag (₹)</label>
              <input type="number" step="0.01" value={form.rate_per_bag} onChange={set("rate_per_bag")} className={inputClass} />
            </div>

            {/* Month-Year — two selects */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Month-Year</label>
              <div className="flex gap-2">
                <select value={form.month} onChange={set("month")} className={selectClass}>
                  <option value="">Month</option>
                  {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={form.month_year_year} onChange={set("month_year_year")} className={selectClass}>
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
          <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
            {[
              { key: "opening_balance", label: "Opening Balance" },
              { key: "received_bags", label: "Received Bags" },
              { key: "issue_bags", label: "Issue Bags" },
              { key: "closing_balance", label: "Closing Balance" },
              { key: "reserve_bags", label: "Reserve Bags" },
              { key: "chargeable_bags", label: "Chargeable Bags" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
                <input
                  type="number"
                  value={(form as any)[key]}
                  onChange={set(key as keyof typeof form)}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          {error && <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">{error}</div>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={editMutation.isPending}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {editMutation.isPending ? "Submitting..." : "Submit Edit Request"}
            </button>
            <Link href={`/bills/${id}`}>
              <button type="button" className="px-6 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
