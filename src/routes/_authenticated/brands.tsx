import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Store, ExternalLink, Crown, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useI18n, useT } from "@/lib/i18n";
import { SUPER_ADMIN_EMAIL } from "@/lib/profile-context";

export const Route = createFileRoute("/_authenticated/brands")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const email = (user.email || "").toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isSuperAdmin = email === SUPER_ADMIN_EMAIL || profile?.role === "super_admin";
    if (!isSuperAdmin) throw redirect({ to: "/dashboard" });
  },
  component: BrandsPage,
});

type Brand = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  primary_color: string | null;
  about_ar: string | null;
  about_en: string | null;
};

function BrandsPage() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const q = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Brand[];
    },
  });

  const brands = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["brands"] });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-1">
            <Crown className="h-3.5 w-3.5" /> {lang === "ar" ? "المدير الأعلى" : "Super Admin"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-display">
            {lang === "ar" ? "العلامات التجارية" : "Brands"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "ar"
              ? "إدارة العلامات التجارية وعزل بيانات كل علامة تجارية."
              : "Create and manage the brands (tenants) hosted on this platform."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 me-2" /> {lang === "ar" ? "علامة تجارية جديدة" : "New Brand"}
            </Button>
          </DialogTrigger>
          <NewBrandDialog onSaved={() => { setOpen(false); refresh(); }} />
        </Dialog>
      </div>

      {brands.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {lang === "ar" ? "لم يتم إنشاء أي علامة تجارية بعد." : "No brands yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.name_en} className="h-10 w-10 rounded object-contain bg-secondary" />
                ) : (
                  <div className="h-10 w-10 rounded bg-secondary grid place-items-center">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg truncate">{b.name_en}</div>
                  <div className="text-xs text-muted-foreground truncate">/{b.slug}</div>
                </div>
                {!b.is_active && (
                  <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground">
                    {lang === "ar" ? "غير مفعل" : "Inactive"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/b/$slug/dashboard" params={{ slug: b.slug }}>
                    {lang === "ar" ? "فتح لوحة التحكم" : "Open workspace"}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/store/$slug" params={{ slug: b.slug }}>
                    <ExternalLink className="h-3.5 w-3.5 me-1.5" />
                    {lang === "ar" ? "المتجر" : "Storefront"}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(b)}>
                  <Pencil className="h-3.5 w-3.5 me-1.5" />
                  {lang === "ar" ? "تعديل" : "Edit"}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleting(b)}>
                  <Trash2 className="h-3.5 w-3.5 me-1.5" />
                  {lang === "ar" ? "حذف" : "Delete"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <EditBrandDialog brand={editing} onSaved={() => { setEditing(null); refresh(); }} />
        </Dialog>
      )}
      {deleting && (
        <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <DeleteBrandDialog brand={deleting} onDone={() => { setDeleting(null); refresh(); }} />
        </Dialog>
      )}
    </div>
  );
}

function NewBrandDialog({ onSaved }: { onSaved: () => void }) {
  const { lang } = useI18n();
  const [form, setForm] = useState({ slug: "", name_en: "", name_ar: "", logo_url: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const slug = form.slug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug)) {
      toast.error(lang === "ar" ? "معرّف غير صالح (a-z, 0-9، -)" : "Invalid slug (a-z, 0-9, -)");
      return;
    }
    if (!form.name_en.trim()) {
      toast.error(lang === "ar" ? "الاسم بالإنجليزية مطلوب" : "English name is required");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from("brands") as any).insert({
        slug,
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || null,
        logo_url: form.logo_url.trim() || null,
        is_active: true,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{lang === "ar" ? "علامة تجارية جديدة" : "New Brand"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{lang === "ar" ? "المعرّف (الرابط)" : "Slug (URL)"}</Label>
          <Input
            placeholder="pura"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "ar" ? "سيظهر في: /b/{المعرّف} و /store/{المعرّف}" : "Used in /b/{slug} and /store/{slug}"}
          </p>
        </div>
        <div>
          <Label>{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
          <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </div>
        <div>
          <Label>{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
          <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
        </div>
        <div>
          <Label>{lang === "ar" ? "رابط الشعار" : "Logo URL"}</Label>
          <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{lang === "ar" ? "إنشاء" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditBrandDialog({ brand, onSaved }: { brand: Brand; onSaved: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [form, setForm] = useState({
    name_en: brand.name_en,
    name_ar: brand.name_ar ?? "",
    logo_url: brand.logo_url ?? "",
    primary_color: brand.primary_color ?? "#8b6f47",
    about_ar: brand.about_ar ?? "",
    about_en: brand.about_en ?? "",
    is_active: brand.is_active,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name_en.trim()) {
      toast.error(isAr ? "الاسم بالإنجليزية مطلوب" : "English name is required");
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from("brands") as any).update({
      name_en: form.name_en.trim(),
      name_ar: form.name_ar.trim() || null,
      logo_url: form.logo_url.trim() || null,
      primary_color: form.primary_color || null,
      about_ar: form.about_ar.trim() || null,
      about_en: form.about_en.trim() || null,
      is_active: form.is_active,
    }).eq("id", brand.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("brands.updateSuccess"));
    onSaved();
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t("brands.editTitle")} — {brand.name_en}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{isAr ? "المعرّف" : "Slug"}</Label>
          <Input value={brand.slug} readOnly disabled />
          <p className="text-xs text-muted-foreground mt-1">
            {isAr ? "لا يمكن تغيير المعرّف لأنه مستخدم في الروابط والفواتير." : "Slug can't be changed — it's used in URLs and invoice links."}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>{isAr ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
            <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>{isAr ? "رابط الشعار" : "Logo URL"}</Label>
          <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
        </div>
        <div>
          <Label>{isAr ? "لون العلامة" : "Brand color"}</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="h-9 w-12 rounded border border-border cursor-pointer" />
            <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>{isAr ? "نبذة (عربي)" : "About (Arabic)"}</Label>
            <Textarea rows={3} value={form.about_ar} onChange={(e) => setForm({ ...form, about_ar: e.target.value })} />
          </div>
          <div>
            <Label>{isAr ? "نبذة (إنجليزي)" : "About (English)"}</Label>
            <Textarea rows={3} value={form.about_en} onChange={(e) => setForm({ ...form, about_en: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center justify-between border border-border rounded-md p-3">
          <div>
            <p className="text-sm font-medium">{isAr ? "نشط" : "Active"}</p>
            <p className="text-xs text-muted-foreground">{isAr ? "إذا كانت غير نشطة، لن تظهر في المتجر." : "Inactive brands are hidden from the storefront."}</p>
          </div>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{t("common.save")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DeleteBrandDialog({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [confirm, setConfirm] = useState("");
  const [hard, setHard] = useState(false);
  const [working, setWorking] = useState(false);

  const countsQ = useQuery({
    queryKey: ["brand-delete-counts", brand.id],
    queryFn: async () => {
      const [{ count: orders }, { count: products }, { count: customers }] = await Promise.all([
        supabase.from("orders").select("id", { head: true, count: "exact" }).eq("brand_id", brand.id),
        supabase.from("products").select("id", { head: true, count: "exact" }).eq("brand_id", brand.id),
        supabase.from("customers").select("id", { head: true, count: "exact" }).eq("brand_id", brand.id),
      ]);
      return { orders: orders ?? 0, products: products ?? 0, customers: customers ?? 0 };
    },
  });
  const counts = countsQ.data;
  const canHardDelete = counts != null && counts.orders === 0 && counts.products === 0;

  useEffect(() => {
    if (!canHardDelete) setHard(false);
  }, [canHardDelete]);

  const run = async () => {
    if (confirm.trim().toLowerCase() !== brand.slug.toLowerCase()) {
      toast.error(isAr ? "المعرّف غير مطابق" : "Slug does not match");
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("delete_brand", { p_brand_id: brand.id, p_hard: hard });
    setWorking(false);
    if (error) return toast.error(error.message);
    toast.success(t("brands.deleteSuccess"));
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> {t("brands.delete")} — {brand.name_en}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("brands.deleteWarning")}</p>
        {counts && (
          <div className="grid grid-cols-3 text-center rounded-md border border-border p-3 text-sm">
            <div><div className="font-display text-lg">{counts.orders}</div><div className="text-xs text-muted-foreground">{isAr ? "طلبات" : "Orders"}</div></div>
            <div><div className="font-display text-lg">{counts.products}</div><div className="text-xs text-muted-foreground">{isAr ? "منتجات" : "Products"}</div></div>
            <div><div className="font-display text-lg">{counts.customers}</div><div className="text-xs text-muted-foreground">{isAr ? "عملاء" : "Customers"}</div></div>
          </div>
        )}
        <label className={`flex items-start gap-2 rounded-md border p-3 text-sm ${canHardDelete ? "border-destructive/40 bg-destructive/5" : "opacity-50"}`}>
          <input
            type="checkbox"
            className="mt-1"
            checked={hard}
            disabled={!canHardDelete}
            onChange={(e) => setHard(e.target.checked)}
          />
          <span>{t("brands.deleteHardOption")}</span>
        </label>
        <div>
          <Label>{t("brands.deleteConfirmText")}</Label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={brand.slug} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="destructive" onClick={run} disabled={working || confirm.trim().toLowerCase() !== brand.slug.toLowerCase()}>
          {working ? "…" : hard ? (isAr ? "حذف نهائي" : "Permanently delete") : (isAr ? "تعطيل ومسح" : "Deactivate and remove")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
