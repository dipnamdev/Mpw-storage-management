import { useState } from "react";
import { Link } from "wouter";
import { useListBills, useListCommodities } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Download, ChevronLeft, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { MP_DISTRICTS } from "@/lib/districts";

interface FilterOptions {
  districts: string[];
  branch_names: string[];
  financial_years: string[];
  month_years: string[];
  depositors: { id: number; name: string; gst_no: string | null }[];
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

const selectClass =
  "px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-full";

export default function BillsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [district, setDistrict] = useState("");
  const [branchName, setBranchName] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [depositorId, setDepositorId] = useState("");
  const [page, setPage] = useState(1);

  const { data: filterOptions } = useFilterOptions();
  const { data: commodities = [] } = useListCommodities();

  const { data, isLoading } = useListBills({
    status: status || undefined,
    district: district || undefined,
    branch_name: branchName || undefined,
    financial_year: financialYear || undefined,
    month_year: monthYear || undefined,
    commodity_id: commodityId ? parseInt(commodityId) : undefined,
    depositor_id: depositorId ? parseInt(depositorId) : undefined,
    page,
    limit: 20,
  } as any);

  // Pending bills summary — always fetches all pending bills regardless of filter
  const { data: pendingData } = useListBills({ status: "pending", limit: 1000 } as any);
  const pendingBills = pendingData?.bills ?? [];
  const pendingCount = pendingData?.total ?? 0;
  const pendingTotal = pendingBills.reduce((sum: number, b: any) => sum + (parseFloat(b.total_charge) || 0), 0);

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
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
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

        {/* Pending summary stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-800">{pendingCount}</div>
              <div className="text-xs text-amber-600 font-medium">Total Pending Bills</div>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-800">{formatCurrency(pendingTotal)}</div>
              <div className="text-xs text-orange-600 font-medium">Total Pending Amount</div>
            </div>
          </div>
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
                          <span className="text-primary hover:underline text-xs">View</span>
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
