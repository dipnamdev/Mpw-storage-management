import { useEffect, useMemo, useState } from "react";
import { useListCommodities } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Filter } from "lucide-react";

interface FilterOptions {
  districts: string[];
  branch_names: string[];
  financial_years: string[];
  month_years: string[];
  depositors: { id: number; name: string; gst_no: string | null }[];
}

export default function ReportsPage() {
  const { toast } = useToast();
  const { data: commodities = [] } = useListCommodities();

  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [commodityId, setCommodityId] = useState("");
  const [depositorId, setDepositorId] = useState("");
  const [district, setDistrict] = useState("");
  const [branchName, setBranchName] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [scheme, setScheme] = useState("PSS");
  const [regionalOffice, setRegionalOffice] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Load filter dropdown options
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("mpw_token");
        const res = await fetch("/api/v1/bills/filter-options", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setFilterOptions(await res.json());
      } finally {
        setLoadingOpts(false);
      }
    })();
  }, []);

  const sortedCommodities = useMemo(
    () => [...commodities].sort((a, b) => a.crop_name.localeCompare(b.crop_name)),
    [commodities],
  );

  const queryString = () => {
    const params = new URLSearchParams();
    if (commodityId) params.set("commodity_id", commodityId);
    if (depositorId) params.set("depositor_id", depositorId);
    if (district) params.set("district", district);
    if (branchName) params.set("branch_name", branchName);
    if (financialYear) params.set("financial_year", financialYear);
    if (monthYear) params.set("month_year", monthYear);
    if (scheme) params.set("scheme", scheme);
    if (regionalOffice) params.set("regional_office", regionalOffice);
    return params;
  };

  // Live preview count for approved bills matching filters
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCount(true);
      try {
        const token = localStorage.getItem("mpw_token");
        const params = new URLSearchParams();
        params.set("status", "approved");
        if (commodityId) params.set("commodity_id", commodityId);
        if (depositorId) params.set("depositor_id", depositorId);
        if (district) params.set("district", district);
        if (branchName) params.set("branch_name", branchName);
        if (financialYear) params.set("financial_year", financialYear);
        if (monthYear) params.set("month_year", monthYear);
        const res = await fetch(`/api/v1/bills/stats?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setCount(data.approved ?? 0);
          setTotalAmount(data.claim_amount ?? 0);
        }
      } finally {
        if (!cancelled) setLoadingCount(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commodityId, depositorId, district, branchName, financialYear, monthYear]);

  const resetFilters = () => {
    setCommodityId(""); setDepositorId(""); setDistrict(""); setBranchName("");
    setFinancialYear(""); setMonthYear(""); setScheme("PSS"); setRegionalOffice("");
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/reports/bills-excel?${queryString().toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        throw new Error(err.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^";]+)"?/);
      a.download = match ? match[1] : `MPWLC_Storage_Bills_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Report generated", description: "Your Excel report has been downloaded." });
    } catch (e: any) {
      toast({ title: "Failed to generate report", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Generate Excel reports of approved bills with custom filters.
            </p>
          </div>
          <button
            onClick={downloadReport}
            disabled={downloading || count === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {downloading ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Generate Excel Report
              </>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Filters</h2>
            <button
              onClick={resetFilters}
              className="ml-auto text-xs text-primary hover:underline"
            >
              Reset all
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Commodity</label>
              <select value={commodityId} onChange={(e) => setCommodityId(e.target.value)} className={inputClass}>
                <option value="">All commodities</option>
                {sortedCommodities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.crop_name} ({c.crop_year})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Depositor</label>
              <select value={depositorId} onChange={(e) => setDepositorId(e.target.value)} className={inputClass} disabled={loadingOpts}>
                <option value="">All depositors</option>
                {(filterOptions?.depositors ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">District</label>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass} disabled={loadingOpts}>
                <option value="">All districts</option>
                {(filterOptions?.districts ?? []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Branch</label>
              <select value={branchName} onChange={(e) => setBranchName(e.target.value)} className={inputClass} disabled={loadingOpts}>
                <option value="">All branches</option>
                {(filterOptions?.branch_names ?? []).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Financial Year</label>
              <select value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className={inputClass} disabled={loadingOpts}>
                <option value="">All financial years</option>
                {(filterOptions?.financial_years ?? []).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Month-Year</label>
              <select value={monthYear} onChange={(e) => setMonthYear(e.target.value)} className={inputClass} disabled={loadingOpts}>
                <option value="">All months</option>
                {(filterOptions?.month_years ?? []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Scheme <span className="text-[10px] opacity-60">(label)</span>
              </label>
              <input
                value={scheme}
                onChange={(e) => setScheme(e.target.value)}
                placeholder="e.g. PSS"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Regional Office <span className="text-[10px] opacity-60">(label)</span>
              </label>
              <input
                value={regionalOffice}
                onChange={(e) => setRegionalOffice(e.target.value)}
                placeholder="e.g. BHOPAL (optional)"
                className={inputClass}
              />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground italic">
            Note: <strong>Scheme</strong> and <strong>Regional Office</strong> are not filters — they appear as
            labels on every row of the generated report.
          </div>
        </div>

        {/* Preview summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Report Preview</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Only <strong>approved</strong> bills are included. Empty filters mean "all".
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Approved bills matching: </span>
                  <span className="font-semibold text-foreground">
                    {loadingCount ? "…" : (count ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total claim amount: </span>
                  <span className="font-semibold text-foreground">
                    ₹{loadingCount ? "…" : (totalAmount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              {!loadingCount && count === 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  No approved bills match your filters. Adjust filters to enable report download.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Format note */}
        <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">Report format:</strong> The Excel file matches the official MPWLC
          storage-bill layout — S.No, Regional Office, District, Branch, Godown, Scheme, Commodity, Crop Year,
          Bill No, Date, Bill Month, Rate per Bag, Bags & Amount for cycle 1 (days 1–15) and cycle 2 (days 16–31),
          Closing bags, and Bill Amount. Bills are grouped by month with subtotals and a grand total.
        </div>
      </div>
    </Layout>
  );
}
