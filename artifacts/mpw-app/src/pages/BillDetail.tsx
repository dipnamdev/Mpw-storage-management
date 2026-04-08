import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetBill, useListDepositors, getListBillsQueryKey, getGetBillQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ArrowLeft, Edit, Trash2, CheckCircle, Lock, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function BillDetailPage() {
  const [, params] = useRoute("/bills/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: bill, isLoading } = useGetBill(id, { query: { enabled: !!id } });
  const { data: depositors = [] } = useListDepositors();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleRequestDelete = async () => {
    if (!deleteReason.trim()) {
      setDeleteError("Please provide a reason for deletion");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await fetch(`/api/v1/bills/${id}/request-delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("mpw_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: deleteReason }),
      });
      queryClient.invalidateQueries({ queryKey: getGetBillQueryKey(id) });
      setShowDeleteDialog(false);
      setDeleteReason("");
      alert("Delete request submitted for admin approval");
    } catch {
      setDeleteError("Failed to submit delete request");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!bill) {
    return (
      <Layout>
        <div className="text-center py-16 text-muted-foreground">Bill not found</div>
      </Layout>
    );
  }

  const operatorDepositor = depositors.find((d) => d.id === (bill as any).depositor_id);

  const fields = [
    { label: "Serial No", value: `#${bill.serial_no}` },
    { label: "Bill No", value: bill.bill_no ?? "—" },
    { label: "District", value: (bill as any).district ?? "—" },
    { label: "Branch", value: bill.branch_name ?? "—" },
    { label: "Godown", value: (bill as any).godown_name ?? "—" },
    { label: "Commodity", value: bill.commodity ? `${bill.commodity.crop_name} (${bill.commodity.crop_year})` : "—" },
    { label: "Financial Year", value: (bill as any).financial_year ?? "—" },
    { label: "Month-Year", value: bill.month_year ?? "—" },
    { label: "Rate/Bag", value: formatCurrency(bill.rate_per_bag) },
    { label: "Opening Balance", value: bill.opening_balance ?? "—" },
    { label: "Received Bags", value: bill.received_bags ?? "—" },
    { label: "Issue Bags", value: bill.issue_bags ?? "—" },
    { label: "Closing Balance", value: bill.closing_balance ?? "—" },
    { label: "Reserve Bags", value: bill.reserve_bags ?? "—" },
    { label: "Chargeable Bags", value: bill.chargeable_bags ?? "—" },
    { label: "Total Charge", value: formatCurrency(bill.total_charge) },
    ...(operatorDepositor ? [{ label: "Depositor", value: operatorDepositor.name + (operatorDepositor.gst_no ? ` (${operatorDepositor.gst_no})` : "") }] : []),
    { label: "Created By", value: bill.creator?.name ?? "—" },
    { label: "Created At", value: formatDateTime(bill.created_at) },
  ];

  return (
    <Layout>
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link href="/bills">
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Bill #{bill.serial_no}</h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={bill.status} />
            {bill.is_locked && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                <Lock className="w-3 h-3" />Locked
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {user?.role === "admin" && bill.status === "pending" && (
            <Link href={`/bills/${bill.id}/approve`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
            </Link>
          )}
          {user?.role === "operator" && !bill.is_locked && (
            <>
              <Link href={`/bills/${bill.id}/request-edit`}>
                <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
                  <Edit className="w-4 h-4" />
                  Request Edit
                </button>
              </Link>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Request Delete
              </button>
            </>
          )}
        </div>

        {/* Delete reason dialog */}
        {showDeleteDialog && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-700">Request Bill Deletion</h3>
              <button onClick={() => { setShowDeleteDialog(false); setDeleteReason(""); setDeleteError(""); }}
                className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-red-600">This will submit a delete request to the admin for approval. Please provide a reason.</p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-red-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
            />
            {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleRequestDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleteLoading ? "Submitting..." : "Submit Delete Request"}
              </button>
              <button
                onClick={() => { setShowDeleteDialog(false); setDeleteReason(""); setDeleteError(""); }}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Bill details */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Bill Details</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {fields.map((f) => (
              <div key={f.label}>
                <div className="text-xs text-muted-foreground mb-0.5">{f.label}</div>
                <div className="text-sm font-medium text-foreground">{String(f.value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Approval details */}
        {bill.approval && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Approval Details</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Depositor</div>
                <div className="text-sm font-medium">{bill.approval.depositor?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Pass Amount</div>
                <div className="text-sm font-medium">{formatCurrency(bill.approval.pass_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Payment Method</div>
                <div className="text-sm font-medium">{bill.approval.payment_method ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">NEFT No</div>
                <div className="text-sm font-medium">{bill.approval.neft_no ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Approved By</div>
                <div className="text-sm font-medium">{bill.approval.approver?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Approved At</div>
                <div className="text-sm font-medium">{formatDateTime(bill.approval.approved_at)}</div>
              </div>
              {bill.approval.remark && (
                <div className="col-span-2 lg:col-span-3">
                  <div className="text-xs text-muted-foreground mb-0.5">Remark</div>
                  <div className="text-sm font-medium">{bill.approval.remark}</div>
                </div>
              )}
              {bill.approval.remark_image_url && (
                <div className="col-span-2 lg:col-span-3">
                  <div className="text-xs text-muted-foreground mb-1">Remark Image</div>
                  <img src={bill.approval.remark_image_url} alt="Remark" className="h-32 rounded-lg object-cover border border-border" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Version history */}
        {bill.versions && bill.versions.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Edit/Delete History</h2>
            <div className="space-y-3">
              {bill.versions.map((v: any) => (
                <div key={v.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <StatusBadge status={v.version_type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">
                      By {v.creator?.name ?? "—"} · {formatDateTime(v.created_at)}
                    </div>
                    {v.version_type === "delete" && v.data_json?.reason && (
                      <div className="mt-1 text-xs text-muted-foreground">Reason: {v.data_json.reason}</div>
                    )}
                    {v.version_type === "edit" && Object.keys(v.data_json).length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Fields: {Object.keys(v.data_json).join(", ")}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
