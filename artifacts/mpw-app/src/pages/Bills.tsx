import { useState } from "react";
import { Link } from "wouter";
import { useListBills, useListCommodities } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";

export default function BillsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [branchName, setBranchName] = useState("");
  const [monthYear, setMonthYear] = useState("");
  const [commodityId, setCommodityId] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListBills({
    status: status || undefined,
    branch_name: branchName || undefined,
    month_year: monthYear || undefined,
    commodity_id: commodityId ? parseInt(commodityId) : undefined,
    page,
    limit: 20,
  });

  const { data: commodities = [] } = useListCommodities();

  const bills = data?.bills ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  const handleExport = () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (branchName) params.set("branch_name", branchName);
    if (monthYear) params.set("month_year", monthYear);
    window.open(`/api/v1/bills/export?${params}`, "_blank");
  };

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
                Export
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

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              type="text"
              placeholder="Branch name..."
              value={branchName}
              onChange={(e) => { setBranchName(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="text"
              placeholder="Month-year (e.g. Jan-2025)"
              value={monthYear}
              onChange={(e) => { setMonthYear(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={commodityId}
              onChange={(e) => { setCommodityId(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Commodities</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.crop_name} ({c.crop_year})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Serial #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Branch</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Commodity</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Month</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Bags</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Charge</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">Loading...</td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">No bills found</td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-foreground">#{bill.serial_no}</td>
                      <td className="px-4 py-3 text-foreground">{bill.bill_no ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground">{bill.branch_name ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground">
                        {bill.commodity?.crop_name ?? "—"}
                        <span className="text-muted-foreground ml-1 text-xs">({bill.commodity?.crop_year})</span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{bill.month_year ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-foreground">{bill.received_bags ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(bill.total_charge)}</td>
                      <td className="px-4 py-3"><StatusBadge status={bill.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(bill.created_at)}</td>
                      <td className="px-4 py-3">
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

          {/* Pagination */}
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
