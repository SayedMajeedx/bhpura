import { createFileRoute, Link, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStorefront, formatPrice } from "@/lib/storefront-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, LogOut, Plus, Trash2, PackageSearch, MapPin, User as UserIcon } from "lucide-react";
import { BAHRAIN_REGIONS, regionLabel } from "@/lib/bahrain-regions";

export const Route = createFileRoute("/store/$slug/account")({
  component: AccountPage,
});

type Customer = {
  id: string;
  brand_id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type OrderRow = {
  id: string;
  invoice_number: number;
  order_date: string;
  status: string;
  total: number;
  currency: string;
  order_items: Array<{ id: string; description: string; quantity: number; unit_price: number }>;
};

type Address = {
  id: string;
  brand_id: string;
  customer_id: string;
  label: string | null;
  region: string | null;
  block: string | null;
  road: string | null;
  house: string | null;
  flat: string | null;
  is_default: boolean;
};

function statusMeta(status: string, isAr: boolean) {
  const s = status.toLowerCase();
  const map: Record<string, { ar: string; en: string; tone: string }> = {
    pending:   { ar: "قيد المعالجة", en: "Pending",   tone: "bg-amber-100 text-amber-900" },
    confirmed: { ar: "مؤكد",         en: "Confirmed", tone: "bg-blue-100 text-blue-900" },
    paid:      { ar: "مدفوع",        en: "Paid",      tone: "bg-emerald-100 text-emerald-900" },
    shipped:   { ar: "تم الشحن",     en: "Shipped",   tone: "bg-indigo-100 text-indigo-900" },
    completed: { ar: "تم التوصيل",   en: "Delivered", tone: "bg-emerald-100 text-emerald-900" },
    cancelled: { ar: "ملغى",         en: "Cancelled", tone: "bg-red-100 text-red-900" },
    refunded:  { ar: "مرتجع",        en: "Refunded",  tone: "bg-neutral-200 text-neutral-800" },
  };
  const m = map[s] ?? { ar: status, en: status, tone: "bg-neutral-200 text-neutral-800" };
  return { label: isAr ? m.ar : m.en, tone: m.tone };
}

function AccountPage() {
  const { brand, session, t, lang, currency } = useStorefront();
  const isAr = lang === "ar";

  if (!session) {
    return <Navigate to="/store/$slug/auth" params={{ slug: brand.slug }} />;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl" style={{ color: "var(--sf-heading)" }}>
            {t("حساب العميل", "My Account")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{session.user?.email}</p>
        </div>
        <SignOutButton />
      </div>

      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="orders" className="gap-2 py-2">
            <PackageSearch className="h-4 w-4" /> <span className="hidden sm:inline">{t("طلباتي", "My orders")}</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2 py-2">
            <UserIcon className="h-4 w-4" /> <span className="hidden sm:inline">{t("البيانات الشخصية", "Profile")}</span>
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2 py-2">
            <MapPin className="h-4 w-4" /> <span className="hidden sm:inline">{t("عناوين الشحن", "Addresses")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <OrdersSection currency={currency} isAr={isAr} lang={lang} />
        </TabsContent>
        <TabsContent value="profile" className="mt-6">
          <ProfileSection isAr={isAr} />
        </TabsContent>
        <TabsContent value="addresses" className="mt-6">
          <AddressesSection isAr={isAr} lang={lang} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function SignOutButton() {
  const { signOut, brand, t } = useStorefront();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        navigate({ to: "/store/$slug", params: { slug: brand.slug }, replace: true });
      }}
    >
      <LogOut className="h-4 w-4 mr-1" />
      {t("تسجيل خروج", "Sign out")}
    </Button>
  );
}

/* ---------- Orders ---------- */

function useCustomer() {
  const { brand, session } = useStorefront();
  return useQuery({
    queryKey: ["storefront-account-customer", brand.id, session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async (): Promise<Customer | null> => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, brand_id, user_id, name, phone, email")
        .eq("brand_id", brand.id)
        .eq("auth_user_id", session!.user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
  });
}

function OrdersSection({ currency, isAr, lang }: { currency: string; isAr: boolean; lang: "ar" | "en" }) {
  const { t } = useStorefront();
  const { data: customer, isLoading: loadingCustomer } = useCustomer();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["storefront-account-orders", customer?.id],
    enabled: !!customer?.id,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, invoice_number, order_date, status, total, currency, order_items(id, description, quantity, unit_price)")
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  if (loadingCustomer || isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!customer || !orders || orders.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        {t("لا توجد طلبات بعد.", "No orders yet.")}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const st = statusMeta(o.status, isAr);
        const date = new Date(o.order_date).toLocaleDateString(isAr ? "ar-BH" : "en-BH", {
          year: "numeric", month: "short", day: "numeric",
        });
        return (
          <Card key={o.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">
                  {t("طلب رقم", "Order")} #{o.invoice_number}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{date}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={`${st.tone} border-0 font-medium`}>{st.label}</Badge>
                <div className="text-sm font-semibold" style={{ color: "var(--sf-heading)" }}>
                  {formatPrice(Number(o.total), o.currency || currency, lang)}
                </div>
              </div>
            </div>
            {o.order_items && o.order_items.length > 0 && (
              <ul className="mt-3 pt-3 border-t space-y-1 text-sm">
                {o.order_items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span className="truncate">{it.description} × {it.quantity}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatPrice(Number(it.unit_price) * it.quantity, o.currency || currency, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Profile ---------- */

function ProfileSection({ isAr }: { isAr: boolean }) {
  const { session, t } = useStorefront();
  const { data: customer, isLoading, refetch } = useCustomer();
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? session?.user?.email ?? "",
      });
    } else if (session) {
      setForm((f) => ({ ...f, email: session.user?.email ?? "" }));
    }
  }, [customer, session]);

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const save = async () => {
    if (!customer) {
      toast.error(t("لا يوجد ملف عميل مرتبط بعد. أنشئ أول طلب لإنشائه.", "No customer profile linked yet. Place your first order to create one."));
      return;
    }
    const name = form.name.trim();
    if (!name) return toast.error(t("الاسم مطلوب", "Name is required"));
    setSaving(true);
    const { error } = await supabase
      .from("customers")
      .update({
        name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      })
      .eq("id", customer.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("تم الحفظ", "Saved"));
    refetch();
  };

  return (
    <Card className="p-5 sm:p-6 space-y-4 max-w-xl">
      <div>
        <Label>{t("الاسم الكامل", "Full name")}</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir={isAr ? "rtl" : "ltr"} />
      </div>
      <div>
        <Label>{t("رقم الهاتف", "Phone number")}</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" dir="ltr" placeholder="+97312345678" />
      </div>
      <div>
        <Label>{t("البريد الإلكتروني", "Email")}</Label>
        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" dir="ltr" />
      </div>
      <div className="pt-2">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {t("حفظ التغييرات", "Save changes")}
        </Button>
      </div>
    </Card>
  );
}

/* ---------- Addresses ---------- */

const emptyAddress = () => ({
  label: "Home",
  region: "" as string,
  block: "",
  road: "",
  house: "",
  flat: "",
  is_default: false,
});

function AddressesSection({ isAr, lang }: { isAr: boolean; lang: "ar" | "en" }) {
  const { t } = useStorefront();
  const qc = useQueryClient();
  const { data: customer, isLoading: loadingCustomer } = useCustomer();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyAddress());
  const [saving, setSaving] = useState(false);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["storefront-account-addresses", customer?.id],
    enabled: !!customer?.id,
    queryFn: async (): Promise<Address[]> => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("id, brand_id, customer_id, label, region, block, road, house, flat, is_default")
        .eq("customer_id", customer!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Address[];
    },
  });

  if (loadingCustomer || isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!customer) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        {t("لا يوجد ملف عميل بعد. أكمل أول طلب لتفعيل حفظ العناوين.", "No customer profile yet. Place your first order to enable saved addresses.")}
      </Card>
    );
  }

  const addAddress = async () => {
    if (!form.region.trim()) {
      return toast.error(t("المنطقة مطلوبة", "Region is required"));
    }
    setSaving(true);
    if (form.is_default) {
      await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", customer.id);
    }
    const { error } = await supabase.from("customer_addresses").insert({
      customer_id: customer.id,
      brand_id: customer.brand_id,
      user_id: customer.user_id,
      label: form.label.trim() || null,
      region: form.region.trim() || null,
      block: form.block.trim() || null,
      road: form.road.trim() || null,
      house: form.house.trim() || null,
      flat: form.flat.trim() || null,
      is_default: form.is_default,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("تم إضافة العنوان", "Address added"));
    setForm(emptyAddress());
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["storefront-account-addresses", customer.id] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("تم الحذف", "Deleted"));
    qc.invalidateQueries({ queryKey: ["storefront-account-addresses", customer.id] });
  };

  const setDefault = async (id: string) => {
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", customer.id);
    const { error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("تم التحديد كافتراضي", "Set as default"));
    qc.invalidateQueries({ queryKey: ["storefront-account-addresses", customer.id] });
  };

  return (
    <div className="space-y-4">
      {(addresses ?? []).length === 0 && !adding && (
        <Card className="p-8 text-center text-muted-foreground">
          {t("لا توجد عناوين محفوظة.", "No saved addresses.")}
        </Card>
      )}

      {(addresses ?? []).map((a) => (
        <Card key={a.id} className="p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{a.label || t("عنوان", "Address")}</span>
              {a.is_default && (
                <Badge className="bg-emerald-100 text-emerald-900 border-0">
                  {t("افتراضي", "Default")}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {[
                a.region && regionLabel(a.region, lang),
                a.block && `${t("مجمع", "Block")} ${a.block}`,
                a.road && `${t("طريق", "Road")} ${a.road}`,
                a.house && `${t("مبنى", "Building")} ${a.house}`,
                a.flat && `${t("شقة", "Flat")} ${a.flat}`,
              ].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex gap-2">
            {!a.is_default && (
              <Button variant="outline" size="sm" onClick={() => setDefault(a.id)}>
                {t("تعيين افتراضي", "Set default")}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </Card>
      ))}

      {adding ? (
        <Card className="p-5 space-y-4">
          <h3 className="font-medium">{t("عنوان جديد", "New address")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("الاسم (اختياري)", "Label (optional)")}</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home" />
            </div>
            <div>
              <Label>{t("المنطقة", "Region")}</Label>
              <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                <SelectTrigger><SelectValue placeholder={t("اختر المنطقة", "Choose region")} /></SelectTrigger>
                <SelectContent>
                  {BAHRAIN_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{isAr ? r.ar : r.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("المجمع", "Block")}</Label>
              <Input value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} inputMode="numeric" />
            </div>
            <div>
              <Label>{t("الطريق", "Road")}</Label>
              <Input value={form.road} onChange={(e) => setForm({ ...form, road: e.target.value })} inputMode="numeric" />
            </div>
            <div>
              <Label>{t("رقم المبنى", "Building")}</Label>
              <Input value={form.house} onChange={(e) => setForm({ ...form, house: e.target.value })} />
            </div>
            <div>
              <Label>{t("رقم الشقة (اختياري)", "Flat (optional)")}</Label>
              <Input value={form.flat} onChange={(e) => setForm({ ...form, flat: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            {t("تعيين كعنوان افتراضي", "Set as default address")}
          </label>
          <div className="flex gap-2">
            <Button onClick={addAddress} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("حفظ العنوان", "Save address")}
            </Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setForm(emptyAddress()); }}>
              {t("إلغاء", "Cancel")}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t("إضافة عنوان جديد", "Add new address")}
        </Button>
      )}

      <div className="text-xs text-muted-foreground pt-2">
        <Link to="/store/$slug" params={{ slug: (useStorefront().brand.slug) }} className="hover:underline" style={{ color: "var(--sf-link)" }}>
          {t("العودة إلى المتجر", "Back to store")}
        </Link>
      </div>
    </div>
  );
}
