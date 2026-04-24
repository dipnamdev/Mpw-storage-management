import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListBills, useListCommodities, useListUsers, getListBillsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Download, Upload, ChevronLeft, ChevronRight, Clock, AlertCircle, FileText, CheckCircle2, XCircle, IndianRupee, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { MP_DISTRICTS } from "@/lib/districts";

interface FilterOptions {
  districts: string[];
  branch_names: string[];
  financial_years: string[];
  month_years: string[];
  depositors: { id: number; name: string; gst_no: string | null }[];
}

interface BillStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  claim_amount: number;
  pending_amount: number;
  total_amount: number;
}

function useFilterOptions() {
  return useQuery<FilterOptions>({
    queryKey: ["bills-filter-options"],
    queryFn: async () => {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch("/api/v1/bills/filter-options", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useBillStats(params: Record<string, string | number | undefined>) {
  return useQuery<BillStats>({
    queryKey: ["bills-stats", params],
    queryFn: async () => {
      const token = localStorage.getItem("mpw_token");
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && v !== null) query.set(k, String(v));
      });
      const res = await fetch(`/api/v1/bills/stats?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });
}

const selectClass =
  "px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-full";

export default function BillsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [location] = useLocation();
  const [status, setStatus] = useState("");
  const [district, setDistrict] = useState("");
  const [branchName, setBranchName] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [depositorId, setDepositorId] = useState("");
  const [createdBy, setCreatedBy] = useState<string>("");
  const [page, setPage] = useState(1);

  // Read created_by / commodity_id / depositor_id from URL on first load / when URL changes
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    setCreatedBy(params.get("created_by") ?? "");
    setCommodityId(params.get("commodity_id") ?? "");
    setDepositorId(params.get("depositor_id") ?? "");
    setPage(1);
  }, [location]);

  const { data: filterOptions } = useFilterOptions();
  const { data: commodities = [] } = useListCommodities();
  const { data: usersList = [] } = useListUsers(undefined, {
    query: { enabled: user?.role === "admin" },
  });
  const filterUser = useMemo(
    () => (createdBy ? usersList.find((u) => String(u.id) === createdBy) : undefined),
    [createdBy, usersList],
  );
  const filterCommodity = useMemo(
    () => (commodityId ? commodities.find((c) => String(c.id) === commodityId) : undefined),
    [commodityId, commodities],
  );
  const filterDepositor = useMemo(
    () => (depositorId ? (filterOptions?.depositors ?? []).find((d) => String(d.id) === depositorId) : undefined),
    [depositorId, filterOptions?.depositors],
  );

  const filterParams = {
    status: status || undefined,
    district: district || undefined,
    branch_name: branchName || undefined,
    financial_year: financialYear || undefined,
    month_year: monthYear || undefined,
    commodity_id: commodityId ? parseInt(commodityId) : undefined,
    depositor_id: depositorId ? parseInt(depositorId) : undefined,
    created_by: createdBy ? parseInt(createdBy) : undefined,
  };

  const { data, isLoading } = useListBills({ ...filterParams, page, limit: 20 } as any);
  const { data: stats } = useBillStats(filterParams);

  const bills = data?.bills ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (district) params.set("district", district);
    if (branchName) params.set("branch_name", branchName);
    if (financialYear) params.set("financial_year", financialYear);
    if (monthYear) params.set("month_year", monthYear);
    if (commodityId) params.set("commodity_id", commodityId);
    if (depositorId) params.set("depositor_id", depositorId);
    if (createdBy) params.set("created_by", createdBy);

    const token = localStorage.getItem("mpw_token");
    try {
      const res = await fetch(`/api/v1/bills/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bills-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same filename later
    if (!file) return;
    setImporting(true);
    try {
      const token = localStorage.getItem("mpw_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/bills/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Import failed");
      const errCount = Array.isArray(json.errors) ? json.errors.length : 0;
      const errSample = errCount > 0
        ? ` First error — row ${json.errors[0].row}: ${json.errors[0].reason}.`
        : "";
      toast({
        title: errCount > 0 ? "Import completed with issues" : "Import successful",
        description: `Updated ${json.updated} bill${json.updated === 1 ? "" : "s"}.` +
          (errCount > 0 ? ` ${errCount} row${errCount === 1 ? "" : "s"} skipped.${errSample}` : ""),
        variant: errCount > 0 ? "destructive" : undefined,
      });
      // Refresh bills list & stats after import
      queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["bills-stats"] });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unable to import the file.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const clearUrlFilter = (key: "created_by" | "commodity_id" | "depositor_id") => {
    if (key === "created_by") setCreatedBy("");
    if (key === "commodity_id") setCommodityId("");
    if (key === "depositor_id") setDepositorId("");
    const sp = new URLSearchParams(window.location.search);
    sp.delete(key);
    const qs = sp.toString();
    window.history.replaceState({}, "", `/bills${qs ? `?${qs}` : ""}`);
  };

  const resetFilters = () => {
    setStatus(""); setDistrict(""); setBranchName("");
    setFinancialYear(""); setMonthYear(""); setCommodityId(""); setDepositorId("");
    setPage(1);
  };

  const hasFilters = status || district || branchName || financialYear || monthYear || commodityId || depositorId;

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bills</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {total} bill{total !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                  title="Download bills as CSV (with Sr, Branch, Bill No., Commodity, Amounts, Cheque/Advice details, Remarks)"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <label
                  className={`flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm transition-colors cursor-pointer ${
                    importing ? "opacity-60 cursor-not-allowed" : "hover:bg-muted"
                  }`}
                  title="Upload an edited CSV to fill in GST tax, Amount Passed, Cheque/RTGS, Advice and Remarks for existing bills (matched by Sr)"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? "Importing…" : "Import CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importing}
                    onChange={handleImportFile}
                  />
                </label>
              </>
            )}
            {user?.role === "operator" && (
              <Link href="/bills/new">
                <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Plus className="w-4 h-4" />
                  Add Bill
                </button>
              </Link>
            )}
          </div>
        </div>

        {(filterUser || filterCommodity || filterDepositor) && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-foreground font-medium">Showing bills for:</span>
            {filterUser && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                Operator: <strong>{filterUser.name}</strong>
                <button onClick={() => clearUrlFilter("created_by")} className="hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filterCommodity && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                Commodity: <strong>{filterCommodity.crop_name} ({filterCommodity.crop_year})</strong>
                <button onClick={() => clearUrlFilter("commodity_id")} className="hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filterDepositor && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                Depositor: <strong>{filterDepositor.name}</strong>
                <button onClick={() => clearUrlFilter("depositor_id")} className="hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={<FileText className="w-4 h-4" />} label="Total Bills" value={stats?.total ?? 0} color="slate" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Approved" value={stats?.approved ?? 0} color="green" />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={stats?.pending ?? 0} color="amber" />
          <StatCard icon={<XCircle className="w-4 h-4" />} label="Rejected" value={stats?.rejected ?? 0} color="red" />
          <StatCard icon={<IndianRupee className="w-4 h-4" />} label="Claim Amount" value={formatCurrency(stats?.claim_amount ?? 0)} color="green" />
          <StatCard icon={<AlertCircle className="w-4 h-4" />} label="Pending Amount" value={formatCurrency(stats?.pending_amount ?? 0)} color="orange" />
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</span>
            {hasFilters && (
              <button onClick={resetFilters} className="text-xs text-primary hover:underline">Clear all</button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectClass}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">District</label>
              <select value={district} onChange={(e) => { setDistrict(e.target.value); setPage(1); }} className={selectClass}>
                <option value="">All Districts</option>
                {MP_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Branch Name</label>
              <select value={branchName} onChange={(e) => { setBranchName(e.target.value); setPage(1); }} className={selectClass}>
                <option value="">All Branches</option>
                {(filterOptions?.branch_names ?? []).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Financial Year</label>
              <select value={financialYear} onChange={(e) => { setFinancialYear(e.target.value); setPage(1); }} className={selectClass}>
                <option value="">All Years</option>
                {(filterOptions?.financial_years ?? []).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Month</label>
              <select value={monthYear} onChange={(e) => { setMonthYear(e.target.value); setPage(1); }} className={selectClass}>
                <option value="">All Months</option>
                {(filterOptions?.month_years ?? []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Commodity</label>
              <select value={commodityId} onChange={(e) => { setCommodityId(e.target.value); setPage(1); }} className={selectClass}>
                <option value="">All Commodities</option>
                {commodities.map((c) => (
                  <option key={c.id} value={c.id}>{c.crop_name} ({c.crop_year})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Depositor</label>
              <select value={depositorId} onChange={(e) => { setDepositorId(e.target.value); setPage(1); }} className={selectClass}>
                <option value="">All Depositors</option>
                {(filterOptions?.depositors ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.gst_no ? ` (${d.gst_no})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Serial #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Bill No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">District</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Branch</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Godown</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Commodity</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Fin. Year</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Month</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Bags</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total Charge</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={13} className="text-center py-12 text-muted-foreground">Loading...</td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-12 text-muted-foreground">No bills found</td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-foreground whitespace-nowrap">#{bill.serial_no}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{bill.bill_no ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{(bill as any).district ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{bill.branch_name ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{(bill as any).godown_name ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {bill.commodity?.crop_name ?? "—"}
                        <span className="text-muted-foreground ml-1 text-xs">({bill.commodity?.crop_year})</span>
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{(bill as any).financial_year ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{bill.month_year ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-foreground">{bill.received_bags ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">{formatCurrency(bill.total_charge)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={bill.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(bill.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/bills/${bill.id}`}>
                          <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                            View
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: "slate" | "green" | "amber" | "red" | "orange" }) {
  const palette = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  }[color];
  return (
    <div className={`border rounded-xl p-3 ${palette}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold mt-1 truncate">{value}</div>
    </div>
  );
}
