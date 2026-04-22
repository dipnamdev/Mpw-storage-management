import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetBill, useListDepositors, getGetBillQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowLeft, Edit, Trash2, CheckCircle, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function BillDetailPage() {
  const [, params] = useRoute("/bills/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: bill, isLoading } = useGetBill(id, { query: { enabled: !!id } });
  const { data: depositors = [] } = useListDepositors();

  const { toast } = useToast();
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
      toast({ title: "Delete request submitted", description: "Your request is pending admin approval." });
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
  const cycleNum = (bill as any).cycle as number | null | undefined;
  const billingDateVal = (bill as any).billing_date as string | null | undefined;
  const billType = (bill as any).bill_type as string | null | undefined;
  const gstBillNo = (bill as any).gst_bill_no as string | null | undefined;
  const deductionAmount = (bill as any).deduction_amount as number | string | null | undefined;
  const passAmount = (bill as any).pass_amount as number | string | null | undefined;

  const fields = [
    { label: "Serial No", value: `#${bill.serial_no}` },
    { label: "Bill No", value: bill.bill_no ?? "—" },
    { label: "Bill Type", value: billType ?? "—" },
    { label: "GST Bill Number", value: gstBillNo ?? "—" },
    { label: "Billing Date", value: billingDateVal ? new Date(billingDateVal).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
    { label: "Billing Cycle", value: cycleNum != null ? `Cycle ${cycleNum}` : "—" },
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
    { label: "Reserve Bags", value: bill.reserve_bags ?? "—" },
    { label: "Chargeable Bags", value: bill.chargeable_bags ?? "—" },
    { label: "Closing Balance", value: bill.closing_balance ?? "—" },
    { label: "Total Charge", value: formatCurrency(bill.total_charge) },
    { label: "Deduction Amount", value: deductionAmount != null ? formatCurrency(deductionAmount) : "—" },
    { label: "Pass Amount", value: passAmount != null ? formatCurrency(passAmount) : "—" },
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
            {bill.is_locked && <span className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5"><Lock className="w-3 h-3" />Locked</span>}
          </div>
        </div>

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
              <button onClick={() => setShowDeleteDialog(true)} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
                Request Delete
              </button>
            </>
          )}
        </div>

        {showDeleteDialog && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-700">Request Bill Deletion</h3>
              <button onClick={() => { setShowDeleteDialog(false); setDeleteReason(""); setDeleteError(""); }} className="text-red-400 hover:text-red-600">×</button>
            </div>
            <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Why do you want to delete this bill?" className="w-full px-3 py-2 rounded-lg border border-red-200 bg-white text-sm resize-none" rows={3} />
            {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
            <div className="flex gap-2">
              <button onClick={handleRequestDelete} disabled={deleteLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60">{deleteLoading ? "Submitting..." : "Submit Request"}</button>
              <button onClick={() => { setShowDeleteDialog(false); setDeleteReason(""); setDeleteError(""); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{field.label}</div>
              <div className="text-sm font-medium text-foreground break-words">{field.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
