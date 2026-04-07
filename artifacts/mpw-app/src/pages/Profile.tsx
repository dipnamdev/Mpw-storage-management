import { useState } from "react";
import { useUpdateUser, useChangePassword, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/Layout";
import { useQueryClient } from "@tanstack/react-query";
import { User, Lock } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateUser();
  const changePasswordMutation = useChangePassword();

  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? "",
    branch_name: user?.branch_name ?? "",
    district_name: user?.district_name ?? "",
    mobile_number: user?.mobile_number ?? "",
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(""); setProfileMsg("");
    try {
      await updateMutation.mutateAsync({
        id: user!.id,
        data: profileForm,
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setProfileMsg("Profile updated successfully");
    } catch {
      setProfileError("Failed to update profile");
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(""); setPasswordMsg("");
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("Passwords do not match");
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({
        data: { current_password: passwordForm.current_password, new_password: passwordForm.new_password },
      });
      setPasswordMsg("Password changed successfully");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch {
      setPasswordError("Current password is incorrect");
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account details</p>
        </div>

        {/* Profile info */}
        <form onSubmit={handleProfileSave} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Personal Information</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input value={user?.email ?? ""} disabled className={inputClass + " opacity-60 cursor-not-allowed"} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Branch Name</label>
              <input value={profileForm.branch_name} onChange={(e) => setProfileForm({ ...profileForm, branch_name: e.target.value })} placeholder="Your branch" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">District</label>
              <input value={profileForm.district_name} onChange={(e) => setProfileForm({ ...profileForm, district_name: e.target.value })} placeholder="Your district" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Mobile Number</label>
              <input value={profileForm.mobile_number} onChange={(e) => setProfileForm({ ...profileForm, mobile_number: e.target.value })} placeholder="+91-XXXXXXXXXX" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <input value={user?.role ?? ""} disabled className={inputClass + " opacity-60 cursor-not-allowed capitalize"} />
            </div>
          </div>

          {profileMsg && <div className="bg-green-50 text-green-700 text-sm px-3 py-2.5 rounded-lg">{profileMsg}</div>}
          {profileError && <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">{profileError}</div>}

          <button type="submit" disabled={updateMutation.isPending} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Change password */}
        <form onSubmit={handlePasswordSave} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Current Password</label>
              <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">New Password</label>
              <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
              <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} className={inputClass} />
            </div>
          </div>

          {passwordMsg && <div className="bg-green-50 text-green-700 text-sm px-3 py-2.5 rounded-lg">{passwordMsg}</div>}
          {passwordError && <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">{passwordError}</div>}

          <button type="submit" disabled={changePasswordMutation.isPending} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
