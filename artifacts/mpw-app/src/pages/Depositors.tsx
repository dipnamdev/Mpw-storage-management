import { useState } from "react";
import { useListDepositors, useCreateDepositor, getListDepositorsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function DepositorsPage() {
  const { data: depositors = [], isLoading } = useListDepositors();
  const createMutation = useCreateDepositor();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", gst_no: "", total_gst: "" });
  const [error, setError] = useState("");

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { setError("Name is required"); return; }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name,
          gst_no: form.gst_no || undefined,
          total_gst: form.total_gst ? parseFloat(form.total_gst) : undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListDepositorsQueryKey() });
      setForm({ name: "", gst_no: "", total_gst: "" });
      setShowAdd(false);
      setError("");
    } catch {
      setError("Failed to create depositor");
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Depositors</h1>
            <p className="text-muted-foreground text-sm mt-1">{depositors.length} depositors registered</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Depositor
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold">Add New Depositor</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Depositor name" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">GST No</label>
                <input value={form.gst_no} onChange={(e) => setForm({ ...form, gst_no: e.target.value })} placeholder="e.g. GST23MP001" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Total GST (%)</label>
                <input type="number" step="0.01" value={form.total_gst} onChange={(e) => setForm({ ...form, total_gst: e.target.value })} placeholder="18.00" className={inputClass} />
              </div>
            </div>
            {error && <div className="text-destructive text-sm">{error}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {createMutation.isPending ? "Adding..." : "Add Depositor"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setError(""); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">GST No</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">GST %</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : depositors.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No depositors yet</td></tr>
              ) : depositors.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">#{d.id}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                  <td className="px-4 py-3 text-foreground">{d.gst_no ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-foreground">{d.total_gst != null ? `${d.total_gst}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
