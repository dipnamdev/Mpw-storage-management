import { useState } from "react";
import { useLocation } from "wouter";
import { useListCommodities, useCreateCommodity, useUpdateCommodity, getListCommoditiesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Plus, Pencil, Trash2, X, Check, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export default function CommoditiesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  const viewBills = (commodityId: number) => navigate(`/bills?commodity_id=${commodityId}`);
  const { data: rawCommodities = [], isLoading } = useListCommodities();
  const commodities = [...rawCommodities].sort((a, b) => b.id - a.id);
  const createMutation = useCreateCommodity();
  const updateMutation = useUpdateCommodity();
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ crop_name: "", crop_year: "", per_bag_per_month: "" });
  const [editForm, setEditForm] = useState({ crop_name: "", crop_year: "", per_bag_per_month: "" });
  const [error, setError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const inputClass = "px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const cellInput = "px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 w-full";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.crop_name || !form.crop_year || !form.per_bag_per_month) { setError("All fields are required"); return; }
    try {
      await createMutation.mutateAsync({
        data: { crop_name: form.crop_name, crop_year: form.crop_year, per_bag_per_month: parseFloat(form.per_bag_per_month) },
      });
      queryClient.invalidateQueries({ queryKey: getListCommoditiesQueryKey() });
      setForm({ crop_name: "", crop_year: "", per_bag_per_month: "" });
      setShowAdd(false);
      setError("");
      toast({ title: "Commodity added", description: `${form.crop_name} (${form.crop_year}) has been added.` });
    } catch {
      setError("Failed to create. Crop+year combination may already exist.");
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({
        params: { id },
        data: {
          crop_name: editForm.crop_name || undefined,
          crop_year: editForm.crop_year || undefined,
          per_bag_per_month: editForm.per_bag_per_month ? parseFloat(editForm.per_bag_per_month) : undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListCommoditiesQueryKey() });
      setEditId(null);
      toast({ title: "Commodity updated" });
    } catch {
      setError("Failed to update commodity");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/commodities/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete commodity");
        return;
      }
      queryClient.invalidateQueries({ queryKey: getListCommoditiesQueryKey() });
      setDeleteConfirmId(null);
      toast({ title: "Commodity deleted" });
    } catch {
      setError("Failed to delete commodity");
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Commodities</h1>
            <p className="text-muted-foreground text-sm mt-1">{rawCommodities.length} commodities registered</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Commodity
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold">Add New Commodity</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Crop Name</label>
                <input value={form.crop_name} onChange={(e) => setForm({ ...form, crop_name: e.target.value })} placeholder="e.g. Wheat" className={inputClass + " w-full"} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Crop Year</label>
                <input value={form.crop_year} onChange={(e) => setForm({ ...form, crop_year: e.target.value })} placeholder="e.g. 2024-25" className={inputClass + " w-full"} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Rate/Bag/Month (₹)</label>
                <input type="number" step="0.01" value={form.per_bag_per_month} onChange={(e) => setForm({ ...form, per_bag_per_month: e.target.value })} placeholder="0.00" className={inputClass + " w-full"} />
              </div>
            </div>
            {error && <div className="text-destructive text-sm">{error}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {createMutation.isPending ? "Adding..." : "Add Commodity"}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setError(""); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        )}

        {error && !showAdd && (
          <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg flex items-center justify-between">
            {error}
            <button onClick={() => setError("")} className="text-destructive hover:opacity-70"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Crop Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Crop Year</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rate/Bag/Month</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : commodities.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No commodities yet</td></tr>
              ) : commodities.map((c) => (
                <>
                  <tr
                    key={c.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/20 ${isAdmin && editId !== c.id ? "cursor-pointer" : ""}`}
                    onClick={(e) => {
                      if (!isAdmin || editId === c.id) return;
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("a") || target.closest("input") || target.closest("select")) return;
                      viewBills(c.id);
                    }}
                  >
                    {editId === c.id ? (
                      <>
                        <td className="px-4 py-2"><input value={editForm.crop_name} onChange={(e) => setEditForm({ ...editForm, crop_name: e.target.value })} className={cellInput} /></td>
                        <td className="px-4 py-2"><input value={editForm.crop_year} onChange={(e) => setEditForm({ ...editForm, crop_year: e.target.value })} className={cellInput} /></td>
                        <td className="px-4 py-2"><input type="number" step="0.01" value={editForm.per_bag_per_month} onChange={(e) => setEditForm({ ...editForm, per_bag_per_month: e.target.value })} className={cellInput + " text-right"} /></td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleUpdate(c.id)} className="p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 border border-border rounded-md hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-foreground">{c.crop_name}</td>
                        <td className="px-4 py-3 text-foreground">{c.crop_year}</td>
                        <td className="px-4 py-3 text-right text-foreground">₹{c.per_bag_per_month}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            {isAdmin && (
                              <button
                                onClick={() => viewBills(c.id)}
                                title="View bills for this commodity"
                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => { setEditId(c.id); setEditForm({ crop_name: c.crop_name, crop_year: c.crop_year, per_bag_per_month: String(c.per_bag_per_month) }); }}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirmId(c.id)}
                              className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {deleteConfirmId === c.id && (
                    <tr key={`del-${c.id}`} className="bg-red-50 border-b border-border">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-red-700">Delete <strong>{c.crop_name} ({c.crop_year})</strong>?</span>
                          <button onClick={() => handleDelete(c.id)} className="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">Confirm Delete</button>
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
