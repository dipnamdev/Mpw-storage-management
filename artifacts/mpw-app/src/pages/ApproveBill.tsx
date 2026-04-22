import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetBill, useListDepositors, useApproveBill, useRejectBill, useUploadImage, getGetBillQueryKey, getListBillsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ArrowLeft, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function ApproveBillPage() {
  const [, params] = useRoute("/bills/:id/approve");
  const id = params?.id ? parseInt(params.id) : 0;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: bill, isLoading } = useGetBill(id, { query: { enabled: !!id } });
  const { data: depositors = [] } = useListDepositors();
  const approveMutation = useApproveBill();
  const rejectMutation = useRejectBill();
  const uploadMutation = useUploadImage();

  const [form, setForm] = useState({
    depositor_id: "",
    pass_amount: "",
    deduction_amount: "",
    payment_method: "",
    neft_no: "",
    remark: "",
    remark_document_url: "",
  });
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string>("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (bill && (bill as any).depositor_id) {
      setForm((prev) => ({ ...prev, depositor_id: String((bill as any).depositor_id) }));
    }
    if (bill && (bill as any).pass_amount != null) {
      setForm((prev) => ({ ...prev, pass_amount: String((bill as any).pass_amount) }));
    }
  }, [bill]);

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await uploadMutation.mutateAsync({ data: formData as any });
      setForm((prev) => ({ ...prev, remark_document_url: result.url }));
      setDocumentPreview(result.url);
      setDocumentName(file.name);
    } catch {
      setError("Failed to upload document");
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.depositor_id || (!form.pass_amount && !form.deduction_amount) || !form.payment_method) {
      setError("Depositor, pass amount, and payment method are required");
      return;
    }
    try {
      await approveMutation.mutateAsync({
        billId: id,
        data: {
          depositor_id: parseInt(form.depositor_id),
          pass_amount: form.pass_amount ? parseFloat(form.pass_amount) : undefined,
          deduction_amount: form.deduction_amount ? parseFloat(form.deduction_amount) : undefined,
          payment_method: form.payment_method,
          neft_no: form.neft_no || undefined,
          remark: form.remark || undefined,
          remark_document_url: form.remark_document_url || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetBillQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
      toast({ title: "Bill approved", description: `Bill #${bill?.serial_no} has been approved successfully.` });
      navigate(`/bills/${id}`);
    } catch {
      setError("Failed to approve bill");
    }
  };

  const handleReject = async () => {
    if (!rejectReason) {
      setError("Please provide a reason for rejection");
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        billId: id,
        data: { reason: rejectReason },
      });
      queryClient.invalidateQueries({ queryKey: getGetBillQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListBillsQueryKey() });
      toast({ title: "Bill rejected", description: `Bill #${bill?.serial_no} has been rejected.` });
      navigate(`/bills/${id}`);
    } catch {
      setError("Failed to reject bill");
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const operatorDepositor = depositors.find((d) => d.id === (bill as any)?.depositor_id);

  return (
    <Layout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Link href={`/bills/${id}`}>
            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Approve Bill #{bill?.serial_no}</h1>
        </div>

        {bill && (
          <div className="bg-muted/40 border border-border rounded-xl p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Branch</div>
                <div className="font-medium">{bill.branch_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Commodity</div>
                <div className="font-medium">{bill.commodity?.crop_name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Charge</div>
                <div className="font-medium text-green-600">{formatCurrency(bill.total_charge)}</div>
              </div>
            </div>
          </div>
        )}

        {operatorDepositor && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            Depositor pre-selected by operator: <strong>{operatorDepositor.name}</strong>
            {operatorDepositor.gst_no ? ` (${operatorDepositor.gst_no})` : ""}. You can change it below if needed.
          </div>
        )}

        <form onSubmit={handleApprove} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Approval Details</h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Depositor *</label>
            <select
              value={form.depositor_id}
              onChange={(e) => setForm({ ...form, depositor_id: e.target.value })}
              required
              className={inputClass}
            >
              <option value="">Select depositor...</option>
              {depositors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.gst_no ? ` (${d.gst_no})` : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Pass Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={form.pass_amount}
                onChange={(e) => setForm({ ...form, pass_amount: e.target.value })}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Deduction Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={form.deduction_amount}
                onChange={(e) => setForm({ ...form, deduction_amount: e.target.value })}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Payment Method *</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                required
                className={inputClass}
              >
                <option value="">Select method...</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="DD">Demand Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">NEFT/Transaction No</label>
            <input
              value={form.neft_no}
              onChange={(e) => setForm({ ...form, neft_no: e.target.value })}
              placeholder="Transaction reference number"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Remark</label>
            <textarea
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="Add any remarks..."
              rows={3}
              className={inputClass + " resize-none"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Remark Document (optional)</label>
            {documentPreview ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border border-border rounded-lg">
                <div className="text-sm">
                  <div className="font-medium">{documentName || "Uploaded document"}</div>
                  <div className="text-xs text-muted-foreground">PDF or image uploaded</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setDocumentPreview(null); setDocumentName(""); setForm({ ...form, remark_document_url: "" }); }}
                  className="w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{uploadMutation.isPending ? "Uploading..." : "Click to upload PDF or image"}</span>
                <input type="file" accept="image/*,application/pdf" onChange={handleDocumentUpload} className="hidden" />
              </label>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={approveMutation.isPending}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Bill"}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(!showReject)}
              className="px-6 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
            >
              Reject Bill
            </button>
            <Link href={`/bills/${id}`}>
              <button type="button" className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
            </Link>
          </div>
        </form>

        {showReject && (
          <div className="bg-card border border-red-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-red-600">Reject Bill</h2>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Reason for Rejection *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-red-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
            </div>
            <button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
