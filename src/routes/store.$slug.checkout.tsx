import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStorefront, formatPrice } from "@/lib/storefront-context";
import { BAHRAIN_REGIONS } from "@/lib/bahrain-regions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CreditCard, Banknote, QrCode, Truck, Store, User } from "lucide-react";

export const Route = createFileRoute("/store/$slug/checkout")({
  component: Checkout,
});

type Fulfillment = "delivery" | "pickup";

function Checkout() {
  const { brand, settings, cart, cartTotal, currency, lang, t, clearCart, session } = useStorefront();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    label: "",
    region: "",
    block: "",
    road: "",
    house: "",
    flat: "",
    notes: "",
  });

  // Pre-fill from linked customer when signed in
  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const { data: customer } = await supabase
          .from("customers")
          .select("name, phone, email, region, block, road, house, flat")
          .eq("brand_id", brand.id)
          .eq("auth_user_id", session.user.id)
          .maybeSingle();
        if (customer) {
          setForm((f) => ({
            ...f,
            name: f.name || customer.name || "",
            phone: f.phone || customer.phone || "",
            email: f.email || customer.email || session.user.email || "",
            region: f.region || customer.region || "",
            block: f.block || (customer as any).block || "",
            road: f.road || customer.road || "",
            house: f.house || customer.house || "",
            flat: f.flat || customer.flat || "",
          }));
        } else if (session.user.email) {
          setForm((f) => ({ ...f, email: f.email || session.user.email || "" }));
        }
      } catch (e) {
        console.error("checkout prefill failed", e);
      }
    })();
  }, [session, brand.id]);

  const availableMethods: Array<{ id: "cod" | "card" | "benefit"; ar: string; en: string; icon: any }> = [
    settings.cod_enabled && { id: "cod" as const, ar: "الدفع عند الاستلام", en: "Cash on delivery", icon: Banknote },
    settings.card_enabled && { id: "card" as const, ar: "الدفع بالبطاقة", en: "Card payment", icon: CreditCard },
    settings.benefit_enabled && { id: "benefit" as const, ar: "عن طريق البنفت", en: "Benefit Pay", icon: QrCode },
  ].filter(Boolean) as any;

  const [method, setMethod] = useState<"cod" | "card" | "benefit" | "">(
    availableMethods[0]?.id ?? "",
  );

  const fulfillmentOptions = useMemo(() => {
    const opts: Array<{ id: Fulfillment; ar: string; en: string; icon: any; fee: number }> = [];
    if (settings.delivery_enabled) opts.push({ id: "delivery", ar: "توصيل", en: "Delivery", icon: Truck, fee: settings.delivery_fee });
    if (settings.pickup_enabled) opts.push({ id: "pickup", ar: "استلام من الفرع", en: "Pickup from branch", icon: Store, fee: 0 });
    return opts;
  }, [settings.delivery_enabled, settings.pickup_enabled, settings.delivery_fee]);

  const [fulfillment, setFulfillment] = useState<Fulfillment>(fulfillmentOptions[0]?.id ?? "delivery");
  useEffect(() => {
    if (fulfillmentOptions.length > 0 && !fulfillmentOptions.find((o) => o.id === fulfillment)) {
      setFulfillment(fulfillmentOptions[0].id);
    }
  }, [fulfillmentOptions, fulfillment]);

  const shipping = fulfillment === "delivery" ? Number(settings.delivery_fee || 0) : 0;
  const grandTotal = cartTotal + shipping;

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <Card className="p-8">
          <p className="mb-4">{t("السلة فارغة", "Your cart is empty")}</p>
          <Link to="/store/$slug" params={{ slug: brand.slug }} className="underline">
            {t("العودة للمتجر", "Back to store")}
          </Link>
        </Card>
      </div>
    );
  }

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error(t("الاسم والهاتف مطلوبان", "Name and phone are required"));
      return;
    }
    if (fulfillment === "delivery") {
      if (!form.region || !form.block.trim() || !form.road.trim() || !form.house.trim()) {
        toast.error(t("يرجى تعبئة كامل عنوان التوصيل", "Please complete the delivery address"));
        return;
      }
    }
    if (!method) {
      toast.error(t("اختر طريقة دفع", "Choose a payment method"));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("place_storefront_order", {
        p_brand_slug: brand.slug,
        p_customer: {
          name: form.name,
          phone: form.phone,
          email: form.email,
          label: form.label,
          region: form.region,
          block: form.block,
          road: form.road,
          house: form.house,
          flat: form.flat,
        },
        p_items: cart.map((c) => ({ variant_id: c.variant_id, quantity: c.qty })),
        p_payment_method: method,
        p_notes: form.notes || undefined,
        p_fulfillment: fulfillment,
      } as any);
      if (error) throw error;
      const orderId = (data as any)?.order_id;
      clearCart();
      toast.success(t("تم استلام طلبك!", "Order placed!"));
      navigate({
        to: "/store/$slug/thank-you/$orderId",
        params: { slug: brand.slug, orderId: String(orderId ?? "") },
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("INSUFFICIENT_STOCK")) {
        toast.error(t("المخزون غير كافٍ لأحد المنتجات", "Insufficient stock for one item"));
      } else if (msg.includes("PAYMENT_METHOD_DISABLED")) {
        toast.error(t("طريقة الدفع غير متاحة", "Payment method unavailable"));
      } else if (msg.includes("DELIVERY_DISABLED") || msg.includes("PICKUP_DISABLED")) {
        toast.error(t("طريقة التسليم غير متاحة", "Fulfillment method unavailable"));
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 grid md:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        {!session && (
          <Card className="p-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-primary/30 bg-primary/5">
            <div className="flex min-w-0 items-center gap-3">
              <User className="h-5 w-5 shrink-0" />
              <p className="text-sm min-w-0 break-words">{t("لديك حساب؟ سجّل الدخول لملء البيانات تلقائيًا.", "Have an account? Sign in to prefill your details.")}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/store/$slug/auth" params={{ slug: brand.slug }}>{t("سجّل الدخول", "Sign in")}</Link>
            </Button>
          </Card>
        )}

        <Card className="p-5 space-y-4">
          <h2 className="font-display text-xl">{t("بيانات العميل", "Customer details")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("الاسم الكامل", "Full name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("رقم الهاتف", "Phone")} *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("البريد الإلكتروني", "Email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t("ملاحظات", "Notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </Card>

        {fulfillmentOptions.length > 0 && (
          <Card className="p-5 space-y-3">
            <h2 className="font-display text-xl">{t("طريقة التسليم", "Fulfillment method")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fulfillmentOptions.map((opt) => {
                const Icon = opt.icon;
                const active = fulfillment === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFulfillment(opt.id)}
                    className={`text-start flex items-center gap-3 p-4 rounded-lg border transition-all ${active ? "border-current" : "border-input"}`}
                    style={active ? { borderColor: settings.primary_color, backgroundColor: `${settings.primary_color}11` } : undefined}
                  >
                    <div className="h-10 w-10 rounded-md grid place-items-center" style={{ backgroundColor: active ? settings.primary_color : "hsl(var(--muted))", color: active ? "#fff" : "inherit" }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{lang === "ar" ? opt.ar : opt.en}</div>
                      <div className="text-xs text-muted-foreground">
                        {opt.fee > 0 ? formatPrice(opt.fee, currency, lang) : t("مجانًا", "Free")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {fulfillment === "delivery" && (
          <Card className="p-5 space-y-4">
            <h2 className="font-display text-xl">{t("عنوان التوصيل", "Delivery address")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("لقب العنوان", "Address label")}</Label>
                <Input placeholder={t("مثل: المنزل، المكتب", "e.g. Home, Work")} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div>
                <Label>{t("المنطقة", "Region")} *</Label>
                <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                  <SelectTrigger><SelectValue placeholder={t("اختر المنطقة", "Select region")} /></SelectTrigger>
                  <SelectContent>
                    {BAHRAIN_REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{lang === "ar" ? r.ar : r.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("المجمع", "Block")} *</Label>
                <Input placeholder={t("مثال: 428", "e.g. 428")} value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} />
              </div>
              <div>
                <Label>{t("الطريق / الشارع", "Road / Avenue")} *</Label>
                <Input placeholder={t("مثال: 2825", "e.g. 2825")} value={form.road} onChange={(e) => setForm({ ...form, road: e.target.value })} />
              </div>
              <div>
                <Label>{t("منزل / بناية", "House / Building")} *</Label>
                <Input placeholder={t("مثال: 12", "e.g. 12")} value={form.house} onChange={(e) => setForm({ ...form, house: e.target.value })} />
              </div>
              <div>
                <Label>{t("شقة (اختياري)", "Flat (optional)")}</Label>
                <Input placeholder={t("مثال: 4", "e.g. 4")} value={form.flat} onChange={(e) => setForm({ ...form, flat: e.target.value })} />
              </div>
            </div>
          </Card>
        )}

        <Card className="p-5 space-y-3">
          <h2 className="font-display text-xl">{t("طريقة الدفع", "Payment method")}</h2>
          {availableMethods.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("لا توجد طرق دفع مفعّلة حالياً.", "No payment methods enabled yet.")}
            </p>
          )}
          <div className="grid gap-2">
            {availableMethods.map((m: any) => {
              const Icon = m.icon;
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`text-start flex items-center gap-3 p-3 rounded-lg border ${active ? "border-current" : "border-input"}`}
                  style={active ? { borderColor: settings.primary_color, backgroundColor: `${settings.primary_color}11` } : undefined}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{lang === "ar" ? m.ar : m.en}</span>
                </button>
              );
            })}
          </div>

          {method === "benefit" && (
            <div className="mt-3 p-4 border rounded-lg bg-muted/40 text-center">
              <p className="text-sm mb-3">
                {t(
                  "امسح رمز الاستجابة السريعة أدناه لإتمام الدفع عن طريق البنفت، ثم اضغط تأكيد الطلب.",
                  "Scan the QR code below to complete payment via Benefit, then confirm your order.",
                )}
              </p>
              {settings.benefit_qr_url ? (
                <img
                  src={settings.benefit_qr_url}
                  alt="Benefit QR"
                  className="mx-auto max-w-[240px] rounded-lg border bg-white p-2"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("لم يقم المتجر برفع رمز البنفت بعد.", "Store hasn't uploaded a Benefit QR yet.")}
                </p>
              )}
            </div>
          )}

          {method === "card" && (
            <div className="mt-3 p-4 border rounded-lg bg-muted/40 text-sm">
              {t(
                "سيتم التواصل معك من قِبل المتجر لإتمام الدفع بالبطاقة.",
                "The store will contact you to complete the card payment.",
              )}
            </div>
          )}
        </Card>
      </div>

      <div>
        <Card className="p-5 sticky top-20 space-y-3">
          <h2 className="font-display text-xl">{t("ملخّص الطلب", "Order summary")}</h2>
          <div className="space-y-2 max-h-72 overflow-auto">
            {cart.map((c) => (
              <div key={c.variant_id} className="flex justify-between text-sm">
                <span className="truncate me-2">
                  {c.name} × {c.qty}
                </span>
                <span>{formatPrice(c.price * c.qty, currency, lang)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("المجموع الفرعي", "Subtotal")}</span>
              <span>{formatPrice(cartTotal, currency, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("رسوم التوصيل", "Delivery fee")}</span>
              <span>{shipping > 0 ? formatPrice(shipping, currency, lang) : t("مجانًا", "Free")}</span>
            </div>
          </div>
          <div className="border-t pt-3 flex justify-between font-semibold text-lg">
            <span>{t("الإجمالي", "Total")}</span>
            <span style={{ color: settings.primary_color }}>{formatPrice(grandTotal, currency, lang)}</span>
          </div>
          <Button
            className="w-full h-12"
            style={{ backgroundColor: settings.primary_color, color: "#fff" }}
            disabled={submitting || availableMethods.length === 0 || fulfillmentOptions.length === 0}
            onClick={submit}
          >
            {submitting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("تأكيد الطلب", "Place order")}
          </Button>
        </Card>
      </div>
    </div>
  );
}
