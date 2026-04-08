import { useState } from "react";
import { useListDepositors, useCreateDepositor, getListDepositorsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function DepositorsPage() {
  const { data: rawDepositors = [], isLoading } = useListDepositors();
  const depositors = [...rawDepositors].sort((a, b) => b.id - a.id);
  const createMutation = useCreateDepositor();
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", gst_no: "", total_gst: "" });
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", gst_no: "", total_gst: "" });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const cellInput = "px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 w-full";

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
      toast({ title: "Depositor added", description: `${form.name} has been added successfully.` });
    } catch {
      setError("Failed to create depositor");
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/depositors/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          gst_no: editForm.gst_no || null,
          total_gst: editForm.total_gst ? parseFloat(editForm.total_gst) : null,
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListDepositorsQueryKey() });
      setEditId(null);
      toast({ title: "Depositor updated" });
    } catch {
      setError("Failed to update depositor");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/depositors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListDepositorsQueryKey() });
      setDeleteConfirmId(null);
      toast({ title: "Depositor deleted" });
    } catch {
      setError("Failed to delete depositor");
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Depositors</h1>
            <p className="text-muted-foreground text-sm mt-1">{rawDepositors.length} depositors registered</p>
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
                <label className="block text-sm font-medium mb-1.5">GST % (Total)</label>
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

        {error && !showAdd && (
          <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">{error}</div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">GST No</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">GST %</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : depositors.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No depositors yet</td></tr>
              ) : depositors.map((d) => (
                <>
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    {editId === d.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={cellInput} />
                        </td>
                        <td className="px-4 py-2">
                          <input value={editForm.gst_no} onChange={(e) => setEditForm({ ...editForm, gst_no: e.target.value })} className={cellInput} />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" step="0.01" value={editForm.total_gst} onChange={(e) => setEditForm({ ...editForm, total_gst: e.target.value })} className={cellInput + " text-right"} />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleUpdate(d.id)} className="p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 border border-border rounded-md hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                        <td className="px-4 py-3 text-foreground">{d.gst_no ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-foreground">{d.total_gst != null ? `${d.total_gst}%` : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => { setEditId(d.id); setEditForm({ name: d.name, gst_no: d.gst_no ?? "", total_gst: d.total_gst != null ? String(d.total_gst) : "" }); }}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirmId(d.id)}
                              className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {deleteConfirmId === d.id && (
                    <tr key={`del-${d.id}`} className="bg-red-50 border-b border-border">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-red-700">Delete <strong>{d.name}</strong>?</span>
                          <button onClick={() => handleDelete(d.id)} className="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">Confirm Delete</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1 border border-red-200 text-red-600 rounded-md text-xs hover:bg-red-100">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
