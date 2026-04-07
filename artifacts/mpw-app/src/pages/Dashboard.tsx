import { useGetDashboardStats, useListNotifications } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Link } from "wouter";
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  IndianRupee,
  GitBranch,
  Bell,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const statCards = [
    {
      label: "Total Bills",
      value: stats?.total_bills ?? 0,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Pending",
      value: stats?.pending_bills ?? 0,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Approved",
      value: stats?.approved_bills ?? 0,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Rejected",
      value: stats?.rejected_bills ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Approved Amount",
      value: formatCurrency(stats?.total_approved_amount),
      icon: IndianRupee,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pending Requests",
      value: stats?.pending_edit_requests ?? 0,
      icon: GitBranch,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of warehouse operations</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Bills by status */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Bills by Status</h2>
            <div className="space-y-3">
              {(stats?.bills_by_status ?? []).map((item) => {
                const total = stats?.total_bills || 1;
                const pct = Math.round((item.count / total) * 100);
                const colorMap: Record<string, string> = {
                  pending: "bg-yellow-400",
                  approved: "bg-green-500",
                  rejected: "bg-red-500",
                };
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="capitalize text-foreground">{item.status}</span>
                      <span className="text-muted-foreground">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colorMap[item.status] ?? "bg-primary"} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent bills */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Recent Bills</h2>
              <Link href="/bills" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {(stats?.recent_bills ?? []).map((bill) => (
                <Link key={bill.id} href={`/bills/${bill.id}`}>
                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        #{bill.serial_no} — {bill.branch_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {bill.commodity?.crop_name ?? "—"} · {formatDate(bill.created_at)}
                      </div>
                    </div>
                    <StatusBadge status={bill.status} />
                  </div>
                </Link>
              ))}
              {(stats?.recent_bills ?? []).length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground">No bills yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
