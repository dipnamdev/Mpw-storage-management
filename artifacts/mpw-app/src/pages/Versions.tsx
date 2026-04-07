import { useState } from "react";
import { useListPendingVersions, useApproveVersion, useRejectVersion, getListPendingVersionsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

const FIELD_LABELS: Record<string, string> = {
  district: "District",
  branch_name: "Branch Name",
  godown_name: "Godown Name",
  bill_no: "Bill No",
  commodity_id: "Commodity ID",
  crop_year: "Crop Year",
  financial_year: "Financial Year",
  month_year: "Month-Year",
  rate_per_bag: "Rate/Bag",
  opening_balance: "Opening Balance",
  received_bags: "Received Bags",
  issue_bags: "Issue Bags",
  closing_balance: "Closing Balance",
  reserve_bags: "Reserve Bags",
  chargeable_bags: "Chargeable Bags",
};

export default function VersionsPage() {
  const { data: versions = [], isLoading } = useListPendingVersions();
  const approveMutation = useApproveVersion();
  const rejectMutation = useRejectVersion();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [showReject, setShowReject] = useState<Record<number, boolean>>({});

  const handleApprove = async (versionId: number) => {
    if (!confirm("Approve this request?")) return;
    await approveMutation.mutateAsync({ versionId });
    queryClient.invalidateQueries({ queryKey: getListPendingVersionsQueryKey() });
  };

  const handleReject = async (versionId: number) => {
    const reason = rejectReasons[versionId];
    if (!reason) {
      alert("Please provide a reason");
      return;
    }
    await rejectMutation.mutateAsync({ versionId, data: { reason } });
    queryClient.invalidateQueries({ queryKey: getListPendingVersionsQueryKey() });
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {versions.length} pending request{versions.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            No pending edit or delete requests
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => {
              const isExpanded = expandedId === version.id;
              const bill = (version as any).bill;
              const changes = version.data_json as Record<string, unknown>;

              return (
                <div key={version.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : version.id)}
                  >
                    <StatusBadge status={version.version_type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        Bill #{bill?.serial_no ?? version.bill_id}
                        {bill?.branch_name && <span className="text-muted-foreground ml-1">— {bill.branch_name}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Requested by {version.creator?.name ?? "—"} · {formatDateTime(version.created_at)}
                      </div>
                    </div>
                    {version.version_type === "edit" && (
                      <span className="text-xs text-muted-foreground">
                        {Object.keys(changes).length} field{Object.keys(changes).length !== 1 ? "s" : ""} changed
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4">
                      {version.version_type === "delete" ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                          This request asks to delete Bill #{bill?.serial_no ?? version.bill_id}. Approving will mark it for deletion.
                        </div>
                      ) : Object.keys(changes).length > 0 ? (
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-3">Field Comparison</h3>
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/40 border-b border-border">
                                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Field</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Current Value</th>
                                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Proposed Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(changes).map(([key, newVal]) => {
                                  const currentVal = bill ? (bill as any)[key] : "—";
                                  return (
                                    <tr key={key} className="border-b border-border last:border-0">
                                      <td className="px-4 py-2.5 font-medium text-foreground">{FIELD_LABELS[key] ?? key}</td>
                                      <td className="px-4 py-2.5 text-muted-foreground">{String(currentVal ?? "—")}</td>
                                      <td className="px-4 py-2.5">
                                        <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">
                                          {String(newVal ?? "—")}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No field changes specified.</div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 flex-wrap items-start">
                        <button
                          onClick={() => handleApprove(version.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>

                        <div className="flex-1">
                          <div className="flex gap-2">
                            <input
                              placeholder="Reason for rejection..."
                              value={rejectReasons[version.id] ?? ""}
                              onChange={(e) => setRejectReasons({ ...rejectReasons, [version.id]: e.target.value })}
                              className="flex-1 px-3 py-2 rounded-lg border border-red-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                            />
                            <button
                              onClick={() => handleReject(version.id)}
                              disabled={rejectMutation.isPending}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        </div>

                        <Link href={`/bills/${version.bill_id}`}>
                          <button className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
                            View Bill
                          </button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
