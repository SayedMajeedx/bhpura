import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStorefront, formatPrice } from "@/lib/storefront-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CreditCard, Banknote, QrCode } from "lucide-react";

export const Route = createFileRoute("/store/$slug/checkout")({
  component: Checkout,
});

function Checkout() {
  const { brand, settings, cart, cartTotal, currency, lang, t, clearCart } = useStorefront();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    notes: "",
  });

  const availableMethods: Array<{ id: "cod" | "card" | "benefit"; ar: string; en: string; icon: any }> = [
    settings.cod_enabled && { id: "cod" as const, ar: "الدفع عند الاستلام", en: "Cash on delivery", icon: Banknote },
    settings.card_enabled && { id: "card" as const, ar: "الدفع بالبطاقة", en: "Card payment", icon: CreditCard },
    settings.benefit_enabled && { id: "benefit" as const, ar: "عن طريق البنفت", en: "Benefit Pay", icon: QrCode },
  ].filter(Boolean) as any;

  const [method, setMethod] = useState<"cod" | "card" | "benefit" | "">(
    availableMethods[0]?.id ?? "",
  );

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
    if (!method) {
      toast.error(t("اختر طريقة دفع", "Choose a payment method"));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("place_storefront_order", {
        p_brand_slug: brand.slug,
        p_customer: form,
        p_items: cart.map((c) => ({ variant_id: c.variant_id, quantity: c.qty })),
        p_payment_method: method,
        p_notes: form.notes || undefined,
      });
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
            <div className="sm:col-span-2">
              <Label>{t("العنوان", "Address")}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>{t("المدينة", "City")}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t("ملاحظات", "Notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </Card>

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
          <div className="border-t pt-3 flex justify-between font-semibold text-lg">
            <span>{t("الإجمالي", "Total")}</span>
            <span style={{ color: settings.primary_color }}>{formatPrice(cartTotal, currency, lang)}</span>
          </div>
          <Button
            className="w-full h-12"
            style={{ backgroundColor: settings.primary_color, color: "#fff" }}
            disabled={submitting || availableMethods.length === 0}
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
