import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Users, Shield, UserX, Check, X, Crown } from "lucide-react";
import { toast } from "sonner";
import { useI18n, useT } from "@/lib/i18n";
import { useProfile, SUPER_ADMIN_EMAIL } from "@/lib/profile-context";
import type { Profile, UserRole, UserStatus } from "@/lib/profile-context";

export const Route = createFileRoute("/_authenticated/team")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, email")
      .eq("id", user.id)
      .maybeSingle();

    // Allow admin + super_admin. If no profile, allow (first-user fallback).
    const role = profile?.role;
    const allowed = !profile ||
      role === "admin" ||
      role === "super_admin" ||
      (profile.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;

    if (!allowed) {
      throw redirect({ to: "/dashboard" });
    }
    if (profile && profile.status !== "active") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: TeamManagement,
});


type StaffMember = Profile;

const USER_MANAGEMENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management`;

async function callUserManagement(action: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("No session");

  const url = new URL(USER_MANAGEMENT_URL);
  url.searchParams.set("action", action);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status})`);
  }
  return result;
}

function TeamManagement() {
  const t = useT();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();
  const { profile: currentUser, isSuperAdmin } = useProfile();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StaffMember | null>(null);

  const staffQ = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const result = await callUserManagement("list");
      return (result.profiles || []) as StaffMember[];
    },
  });

  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "staff" as UserRole,
  });

  const resetForm = () => {
    setForm({ email: "", name: "", password: "", role: "staff" });
  };

  const handleAdd = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      toast.error(isAr ? "البريد الإلكتروني وكلمة المرور مطلوبان" : "Email and password are required");
      return;
    }

    try {
      await callUserManagement("create", {
        email: form.email.trim(),
        name: form.name.trim() || undefined,
        password: form.password,
        role: form.role,
      });
      toast.success(isAr ? "تمت إضافة المستخدم بنجاح" : "User added successfully");
      setAddOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل إضافة المستخدم" : "Failed to add user"));
    }
  };

  const handleUpdate = async (userId: string, updates: { role?: UserRole; status?: UserStatus; name?: string }) => {
    try {
      await callUserManagement("update", { userId, ...updates });
      toast.success(isAr ? "تم التحديث بنجاح" : "Updated successfully");
      setEditOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل التحديث" : "Failed to update"));
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await callUserManagement("delete", { userId });
      toast.success(isAr ? "تم حذف المستخدم" : "User deleted");
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err: any) {
      toast.error(err.message || (isAr ? "فشل الحذف" : "Failed to delete"));
    }
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setEditOpen(true);
  };

  const staff = staffQ.data ?? [];
  const locale = isAr ? "ar-BH" : "en-US";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display">
            {isAr ? "إدارة الموظفين" : "Team Management"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAr
              ? "أضف وأدِر حسابات الموظفين. فقط المدراء يمكنهم رؤية هذه الصفحة."
              : "Add and manage staff accounts. Only admins can view this page."}
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 me-2" />
              {isAr ? "إضافة موظف" : "Add Staff"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isAr ? "إضافة موظف جديد" : "Add New Staff Member"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("customers.name")}</Label>
                <Input
                  className="text-start"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={isAr ? "الاسم (اختياري)" : "Name (optional)"}
                />
              </div>
              <div>
                <Label>{t("auth.email")} <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  className="text-start"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={isAr ? "example@email.com" : "example@email.com"}
                />
              </div>
              <div>
                <Label>{t("auth.password")} <span className="text-destructive">*</span></Label>
                <Input
                  type="password"
                  className="text-start"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isAr ? "كلمة مرور مؤقتة" : "Temporary password"}
                />
              </div>
              <div>
                <Label>{isAr ? "الدور" : "Role"}</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger className="text-start">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {isAr ? "موظف" : "Staff"}
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {isAr ? "مدير" : "Admin"}
                      </div>
                    </SelectItem>
                    {isSuperAdmin && (
                      <SelectItem value="super_admin">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          {isAr ? "مدير عام" : "Super Admin"}
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "سيتمكن المستخدم من تسجيل الدخول فوراً. يمكنه تغيير كلمة المرور لاحقاً."
                  : "The user will be able to sign in immediately. They can change their password later."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setAddOpen(false); resetForm(); }}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAdd}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {staff.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {isAr ? "لا يوجد موظفين بعد." : "No staff members yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4 text-start">{isAr ? "الاسم" : "Name"}</th>
                  <th className="p-4 text-start">{isAr ? "البريد الإلكتروني" : "Email"}</th>
                  <th className="p-4 text-start">{isAr ? "الدور" : "Role"}</th>
                  <th className="p-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                  <th className="p-4 text-start">{isAr ? "تاريخ الإنشاء" : "Created"}</th>
                  <th className="p-4 text-end">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id} className="border-t border-border">
                    <td className="p-4 font-medium">{member.name || member.email.split("@")[0]}</td>
                    <td className="p-4 text-muted-foreground" dir="ltr">{member.email}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          member.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {member.role === "admin" ? (
                          <>
                            <Shield className="h-3 w-3" />
                            {isAr ? "مدير" : "Admin"}
                          </>
                        ) : (
                          <>
                            <Users className="h-3 w-3" />
                            {isAr ? "موظف" : "Staff"}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          member.status === "active"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        {member.status === "active" ? (
                          <>
                            <Check className="h-3 w-3" />
                            {isAr ? "نشط" : "Active"}
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            {isAr ? "غير نشط" : "Inactive"}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString(locale)}
                    </td>
                    <td className="p-4 text-end">
                      <div className="flex items-center justify-end gap-1">
                        {/* Can't deactivate or delete self */}
                        {member.id !== currentUser?.id && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {member.status === "active" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={isAr ? "إلغاء تفعيل الحساب" : "Deactivate account"}
                                onClick={() => handleUpdate(member.id, { status: "inactive" })}
                              >
                                <UserX className="h-4 w-4 text-amber-600" />
                              </Button>
                            )}
                            {member.status === "inactive" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={isAr ? "إعادة تفعيل الحساب" : "Reactivate account"}
                                onClick={() => handleUpdate(member.id, { status: "active" })}
                              >
                                <Check className="h-4 w-4 text-emerald-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm(member)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? "تعديل المستخدم" : "Edit User"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>{t("customers.name")}</Label>
                <Input
                  className="text-start"
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{isAr ? "الدور" : "Role"}</Label>
                <Select
                  value={editing.role}
                  onValueChange={(v) => setEditing({ ...editing, role: v as UserRole })}
                >
                  <SelectTrigger className="text-start">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {isAr ? "موظف" : "Staff"}
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {isAr ? "مدير" : "Admin"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isAr ? "الحالة" : "Status"}</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => setEditing({ ...editing, status: v as UserStatus })}
                >
                  <SelectTrigger className="text-start">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" />
                        {isAr ? "نشط" : "Active"}
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-amber-600" />
                        {isAr ? "غير نشط" : "Inactive"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditOpen(false); setEditing(null); }}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (editing) {
                  handleUpdate(editing.id, {
                    name: editing.name || undefined,
                    role: editing.role,
                    status: editing.status,
                  });
                }
              }}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "حذف المستخدم" : "Delete User"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm && (
                <>
                  {isAr ? (
                    <>
                      هل أنت متأكد من حذف <strong>{deleteConfirm.name || deleteConfirm.email}</strong>؟
                      <br />
                      سيتم حذف جميع بيانات المستخدم نهائياً. لا يمكن التراجع عن هذا الإجراء.
                    </>
                  ) : (
                    <>
                      Are you sure you want to delete <strong>{deleteConfirm.name || deleteConfirm.email}</strong>?
                      <br />
                      All user data will be permanently deleted. This action cannot be undone.
                    </>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
