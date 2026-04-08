import { useState } from "react";
import { useListUsers, useCreateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { MP_DISTRICTS } from "@/lib/districts";
import { SearchableSelect } from "@/components/SearchableSelect";
import { PasswordInput } from "@/components/PasswordInput";

export default function UsersPage() {
  const { data: users = [], isLoading } = useListUsers();
  const createMutation = useCreateUser();
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "operator" as "admin" | "operator",
    branch_name: "", district_name: "", mobile_number: "",
  });
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", branch_name: "", district_name: "", mobile_number: "" });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const cellInput = "px-2 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 w-full";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError("Name, email, and password are required"); return; }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          branch_name: form.branch_name ? form.branch_name.toUpperCase() : undefined,
          district_name: form.district_name || undefined,
          mobile_number: form.mobile_number || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setForm({ name: "", email: "", password: "", role: "operator", branch_name: "", district_name: "", mobile_number: "" });
      setShowAdd(false);
      setError("");
      toast({ title: "User created", description: `${form.name} has been added as ${form.role}.` });
    } catch {
      setError("Failed to create user. Email may already exist.");
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/users/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          branch_name: editForm.branch_name ? editForm.branch_name.toUpperCase() : null,
          district_name: editForm.district_name || null,
          mobile_number: editForm.mobile_number || null,
        }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setEditId(null);
      toast({ title: "User updated" });
    } catch {
      setError("Failed to update user");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem("mpw_token");
      const res = await fetch(`/api/v1/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete user");
        return;
      }
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setDeleteConfirmId(null);
      toast({ title: "User deleted" });
    } catch {
      setError("Failed to delete user");
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-muted-foreground text-sm mt-1">{users.length} users</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleCreate} className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold">Create New User</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@mpw.com" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Password *</label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 8 chars"
                  inputClassName="py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "operator" })} className={inputClass}>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Branch Name</label>
                <input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value.toUpperCase() })} placeholder="BRANCH NAME" className={inputClass + " uppercase"} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">District</label>
                <SearchableSelect options={MP_DISTRICTS} value={form.district_name} onChange={(v) => setForm({ ...form, district_name: v })} placeholder="Select district..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Mobile Number</label>
                <input value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} placeholder="+91-XXXXXXXXXX" className={inputClass} />
              </div>
            </div>
            {error && <div className="text-destructive text-sm">{error}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                {createMutation.isPending ? "Creating..." : "Create User"}
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">District</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Branch</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mobile</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No users yet</td></tr>
              ) : users.map((u) => (
                <>
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    {editId === u.id ? (
                      <>
                        <td className="px-4 py-2"><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={cellInput} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>{u.role}</span>
                        </td>
                        <td className="px-4 py-2">
                          <select value={editForm.district_name} onChange={(e) => setEditForm({ ...editForm, district_name: e.target.value })} className={cellInput}>
                            <option value="">—</option>
                            {MP_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2"><input value={editForm.branch_name} onChange={(e) => setEditForm({ ...editForm, branch_name: e.target.value.toUpperCase() })} className={cellInput + " uppercase"} /></td>
                        <td className="px-4 py-2"><input value={editForm.mobile_number} onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })} className={cellInput} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleUpdate(u.id)} className="p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 border border-border rounded-md hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                        <td className="px-4 py-3 text-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-foreground">{u.district_name ?? "—"}</td>
                        <td className="px-4 py-3 text-foreground">{u.branch_name ?? "—"}</td>
                        <td className="px-4 py-3 text-foreground">{u.mobile_number ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => { setEditId(u.id); setEditForm({ name: u.name, branch_name: u.branch_name ?? "", district_name: u.district_name ?? "", mobile_number: u.mobile_number ?? "" }); }}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirmId(u.id)}
                              className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {deleteConfirmId === u.id && (
                    <tr key={`del-${u.id}`} className="bg-red-50 border-b border-border">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-red-700">Delete user <strong>{u.name}</strong> ({u.email})?</span>
                          <button onClick={() => handleDelete(u.id)} className="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">Confirm Delete</button>
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
