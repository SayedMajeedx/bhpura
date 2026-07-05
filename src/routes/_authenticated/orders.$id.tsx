import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Printer, Save, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";


export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderDetail,
});

type Order = any;
type Item = {
  id?: string; product_id?: string | null; variant_id?: string | null;
  description: string; quantity: number; unit_price: number;
  customizations: { name: string; price_delta: number }[];
  customization_total: number; line_total: number;
};

function OrderDetail() {
  const t = useT();
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(*), order_items(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Order;
    },
  });
  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*")).data ?? [],
  });
  const variantsQ = useQuery({
    queryKey: ["variants"],
    queryFn: async () => (await supabase.from("product_variants").select("*")).data ?? [],
  });
  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });
  const customQ = useQuery({
    queryKey: ["customizations"],
    queryFn: async () => (await supabase.from("customization_options").select("*").order("name")).data ?? [],
  });
  const settingsQ = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("business_settings").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (orderQ.data) {
      setOrder(orderQ.data);
      setItems((orderQ.data.order_items ?? []).map((i: any) => ({
        id: i.id, product_id: i.product_id, variant_id: i.variant_id,
        description: i.description, quantity: i.quantity, unit_price: Number(i.unit_price),
        customizations: i.customizations ?? [],
        customization_total: Number(i.customization_total),
        line_total: Number(i.line_total),
      })));
    }
  }, [orderQ.data]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    const discount = Number(order?.discount ?? 0);
    const shipping = Number(order?.shipping ?? 0);
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = taxable * Number(order?.tax_rate ?? 0) / 100;
    const total = taxable + taxAmount + shipping;
    return { subtotal, discount, shipping, taxAmount, total };
  }, [items, order?.discount, order?.shipping, order?.tax_rate]);

  if (!order || !settingsQ.data) return <div className="p-8">Loading…</div>;

  const currency = order.currency ?? "SAR";

  const addItem = () => {
    setItems([...items, {
      description: "", quantity: 1, unit_price: 0, customizations: [],
      customization_total: 0, line_total: 0,
    }]);
  };

  const recalc = (i: Item): Item => {
    const custTotal = i.customizations.reduce((s, c) => s + Number(c.price_delta), 0);
    const line = (Number(i.unit_price) + custTotal) * Number(i.quantity);
    return { ...i, customization_total: custTotal, line_total: line };
  };

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems(items.map((it, i) => i === idx ? recalc({ ...it, ...patch }) : it));
  };

  const pickVariant = (idx: number, variantId: string) => {
    const v = variantsQ.data?.find((x: any) => x.id === variantId);
    const p = productsQ.data?.find((x: any) => x.id === v?.product_id);
    if (!v || !p) return;
    const desc = `${p.name}${v.size ? ` · ${v.size}` : ""}${v.color ? ` · ${v.color}` : ""}${v.fabric ? ` · ${v.fabric}` : ""}`;
    updateItem(idx, { product_id: p.id, variant_id: v.id, description: desc, unit_price: Number(v.selling_price) });
  };

  const toggleCustom = (idx: number, c: { name: string; price_delta: number }) => {
    const it = items[idx];
    const exists = it.customizations.find((x) => x.name === c.name);
    const newCust = exists ? it.customizations.filter((x) => x.name !== c.name) : [...it.customizations, c];
    updateItem(idx, { customizations: newCust });
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: oe } = await supabase.from("orders").update({
      customer_id: order.customer_id, status: order.status, notes: order.notes,
      discount: totals.discount, tax_rate: order.tax_rate, tax_amount: totals.taxAmount,
      shipping: totals.shipping, subtotal: totals.subtotal, total: totals.total,
      currency, order_date: order.order_date,
    }).eq("id", order.id);
    if (oe) return toast.error(oe.message);

    await supabase.from("order_items").delete().eq("order_id", order.id);
    if (items.length > 0) {
      const { error: ie } = await supabase.from("order_items").insert(
        items.map((i) => ({
          user_id: user.id, order_id: order.id,
          product_id: i.product_id ?? null, variant_id: i.variant_id ?? null,
          description: i.description, quantity: i.quantity, unit_price: i.unit_price,
          customizations: i.customizations, customization_total: i.customization_total, line_total: i.line_total,
        })),
      );
      if (ie) return toast.error(ie.message);
    }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link to="/orders" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("orderDetail.back")}
        </Link>
        <div className="flex gap-2">
          <SendInvoiceDialog order={order} totals={totals} settings={settingsQ.data} currency={currency} />
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> {t("common.print")}</Button>
          <Button onClick={save}><Save className="h-4 w-4 mr-2" /> {t("common.save")}</Button>
        </div>
      </div>

      {/* Editor - hidden on print */}
      <div className="no-print space-y-4 mb-8">
        <Card className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Customer</Label>
              <Select value={order.customer_id ?? "none"} onValueChange={(v) => setOrder({ ...order, customer_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No customer —</SelectItem>
                  {(customersQ.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Order date</Label>
              <Input type="date" value={order.order_date} onChange={(e) => setOrder({ ...order, order_date: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={order.status} onValueChange={(v) => setOrder({ ...order, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg">Line items</h3>
            <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add line</Button>
          </div>
          {items.length === 0 && <p className="text-sm text-muted-foreground">No lines. Add products from your inventory.</p>}
          <div className="space-y-4">
            {items.map((it, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-5">
                    <Label>From inventory</Label>
                    <Select value={it.variant_id ?? "custom"} onValueChange={(v) => v !== "custom" && pickVariant(idx, v)}>
                      <SelectTrigger><SelectValue placeholder="Pick a variant..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">— Custom line —</SelectItem>
                        {(variantsQ.data ?? []).map((v: any) => {
                          const p = productsQ.data?.find((x: any) => x.id === v.product_id);
                          if (!p) return null;
                          return (
                            <SelectItem key={v.id} value={v.id}>
                              {p.name} {v.size ? `· ${v.size}` : ""} {v.color ? `· ${v.color}` : ""} — {formatMoney(v.selling_price, currency)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Label>Description</Label>
                    <Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                  </div>
                  <div className="col-span-1"><Label>Qty</Label>
                    <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></div>
                  <div className="col-span-2"><Label>Unit price</Label>
                    <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} /></div>
                </div>
                <div>
                  <Label className="text-xs">Customizations</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(customQ.data ?? []).map((c: any) => {
                      const active = it.customizations.some((x) => x.name === c.name);
                      return (
                        <button key={c.id} type="button"
                          onClick={() => toggleCustom(idx, { name: c.name, price_delta: Number(c.price_delta) })}
                          className={`text-xs px-2 py-1 rounded-full border ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>
                          {c.name} +{formatMoney(c.price_delta, currency)}
                        </button>
                      );
                    })}
                    {(customQ.data ?? []).length === 0 && <span className="text-xs text-muted-foreground">Add options in Inventory → Customization add-ons.</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Line total</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatMoney(it.line_total, currency)}</span>
                    <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label>Notes</Label>
              <Textarea value={order.notes ?? ""} onChange={(e) => setOrder({ ...order, notes: e.target.value })} rows={5} />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Discount</Label>
                  <Input type="number" step="0.01" value={order.discount} onChange={(e) => setOrder({ ...order, discount: Number(e.target.value) })} /></div>
                <div><Label>Shipping</Label>
                  <Input type="number" step="0.01" value={order.shipping} onChange={(e) => setOrder({ ...order, shipping: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Tax rate (%)</Label>
                <Input type="number" step="0.01" value={order.tax_rate} onChange={(e) => setOrder({ ...order, tax_rate: Number(e.target.value) })} /></div>
              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
                <Row label={`Discount`} value={`− ${formatMoney(totals.discount, currency)}`} />
                <Row label={`VAT (${order.tax_rate}%)`} value={formatMoney(totals.taxAmount, currency)} />
                <Row label="Shipping" value={formatMoney(totals.shipping, currency)} />
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-display text-lg">Total</span>
                  <span className="font-display text-lg">{formatMoney(totals.total, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Printable invoice */}
      <InvoicePreview
        order={{ ...order, subtotal: totals.subtotal, tax_amount: totals.taxAmount, total: totals.total }}
        items={items}
        settings={settingsQ.data}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

const INVOICE_LABELS = {
  en: {
    invoice: "INVOICE", invoiceNumber: "Invoice #",
    date: "Date", status: "Status", billTo: "Bill to",
    paymentMethod: "Payment method", vatLabel: "VAT",
    item: "Item", description: "Description", qty: "Qty", unit: "Unit Price", price: "Price", total: "Total",
    subtotal: "Subtotal", discount: "Discount", vat: "VAT", shipping: "Shipping", grandTotal: "Grand Total",
    notes: "Notes", warmRegards: "Warm regards",
    language: "Language", english: "English", arabic: "العربية",
  },
  ar: {
    invoice: "فاتورة", invoiceNumber: "رقم الفاتورة",
    date: "التاريخ", status: "الحالة", billTo: "فاتورة إلى",
    paymentMethod: "طريقة الدفع", vatLabel: "الرقم الضريبي",
    item: "الصنف", description: "الوصف", qty: "الكمية", unit: "سعر الوحدة", price: "السعر", total: "الإجمالي",
    subtotal: "المجموع الفرعي", discount: "الخصم", vat: "ضريبة القيمة المضافة", shipping: "الشحن", grandTotal: "الإجمالي الكلي",
    notes: "ملاحظات", warmRegards: "مع أطيب التحيات",
    language: "اللغة", english: "English", arabic: "العربية",
  },
} as const;
const BRAND: Record<"en" | "ar", string> = { en: "Pura", ar: "بيورا" };
const LEGACY_BRAND_NAMES = new Set(["Abaya Atelier", "أباية أتيليه"]);
function brandFor(lang: "en" | "ar", stored?: string | null) {
  const s = (stored ?? "").trim();
  if (!s || LEGACY_BRAND_NAMES.has(s)) return BRAND[lang];
  return s;
}

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  draft: { en: "Draft", ar: "مسودة" },
  confirmed: { en: "Confirmed", ar: "مؤكدة" },
  paid: { en: "Paid", ar: "مدفوعة" },
  pending: { en: "Pending", ar: "قيد الانتظار" },
  shipped: { en: "Shipped", ar: "تم الشحن" },
  completed: { en: "Completed", ar: "مكتملة" },
  cancelled: { en: "Cancelled", ar: "ملغاة" },
  refunded: { en: "Refunded", ar: "مستردة" },
};

const PAYMENT_LABELS: Record<string, { en: string; ar: string }> = {
  cash: { en: "Cash", ar: "نقدًا" },
  card: { en: "Card", ar: "بطاقة" },
  bank_transfer: { en: "Bank transfer", ar: "تحويل بنكي" },
  transfer: { en: "Bank transfer", ar: "تحويل بنكي" },
  benefit: { en: "Benefit", ar: "بنفت" },
  apple_pay: { en: "Apple Pay", ar: "أبل باي" },
  google_pay: { en: "Google Pay", ar: "جوجل باي" },
  cod: { en: "Cash on delivery", ar: "الدفع عند الاستلام" },
};

function tStatus(s: string | null | undefined, lang: "en" | "ar") {
  if (!s) return "";
  return STATUS_LABELS[s]?.[lang] ?? s;
}
function tPayment(s: string | null | undefined, lang: "en" | "ar") {
  if (!s) return "";
  return PAYMENT_LABELS[s]?.[lang] ?? s;
}

// Localize numerals (Arabic-Indic) inside a rendered money/number string
function toArabicDigits(str: string) {
  const map = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  return str.replace(/[0-9]/g, (d) => map[+d]);
}

function InvoicePreview({ order, items, settings }: { order: any; items: Item[]; settings: any }) {
  const currency = order.currency;
  const color = settings.primary_color || "#8b6f47";
  const bg = settings.background_color || "#ffffff";
  const text = settings.text_color || "#1a1a1a";
  const fontSize = Number(settings.font_size) || 14;
  const logoX = Number(settings.logo_x) || 0;
  const logoY = Number(settings.logo_y) || 0;
  const logoW = Number(settings.logo_width) || 160;
  const logoH = Number(settings.logo_height) || 64;

  const [invoiceLang, setInvoiceLang] = useState<"en" | "ar">("en");
  const L = INVOICE_LABELS[invoiceLang];
  const isRTL = invoiceLang === "ar";
  const locale = isRTL ? "ar-BH" : "en-US";
  const money = (n: number) => {
    const s = formatMoney(n, currency, locale);
    return isRTL ? toArabicDigits(s) : s;
  };
  const num = (n: number | string) => (isRTL ? toArabicDigits(String(n)) : String(n));

  const family = isRTL
    ? `"Tajawal", "Cairo", sans-serif`
    : settings.font_family === "Custom (uploaded)"
      ? "'InvoiceCustomFont', sans-serif"
      : `"${settings.font_family || "Cormorant Garamond"}", serif`;


  return (
    <div className="space-y-2">
      {/* Invoice controls (not printed) */}
      <div className="print:hidden flex flex-wrap items-center justify-end gap-2">
        <Label className="text-xs text-muted-foreground">{L.language}:</Label>
        <div className="inline-flex rounded-md border border-input overflow-hidden">
          <button
            type="button"
            onClick={() => setInvoiceLang("en")}
            className={`px-3 py-1 text-xs ${invoiceLang === "en" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {L.english}
          </button>
          <button
            type="button"
            onClick={() => setInvoiceLang("ar")}
            className={`px-3 py-1 text-xs ${invoiceLang === "ar" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {L.arabic}
          </button>
        </div>
      </div>

      <div
        dir={isRTL ? "rtl" : "ltr"}
        lang={invoiceLang}
        className="printable-invoice rounded-lg shadow-lg border border-border overflow-hidden"
        style={{ backgroundColor: bg, color: text, fontFamily: family, fontSize: `${fontSize}px`, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as any}
      >
        {settings.font_url && !isRTL && (
          <style>{`@font-face { font-family: 'InvoiceCustomFont'; src: url('${settings.font_url}'); font-display: swap; }`}</style>
        )}
        <style>{`
          @media print {
            @page { margin: 12mm; }
            body { background: #fff !important; }
            .printable-invoice { direction: ${isRTL ? "rtl" : "ltr"} !important; unicode-bidi: isolate; box-shadow: none !important; border: 0 !important; }
            .printable-invoice * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          }
        `}</style>
        <div className="p-10" style={{ borderTop: `6px solid ${color}` }}>
          <div className="flex justify-between items-start mb-10 gap-6">
            <div className="flex-1 min-w-0">
              {settings.logo_url && (
                <div
                  className="relative mb-3"
                  style={{ height: logoH + logoY + 8 }}
                >
                  <img
                    src={settings.logo_url}
                    alt="logo"
                    draggable={false}
                    style={{
                      position: "absolute",
                      insetInlineStart: logoX,
                      top: logoY,
                      width: logoW,
                      height: logoH,
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
              <h2 style={{ color, fontSize: `${fontSize * 1.75}px`, fontWeight: 600 }}>{brandFor(invoiceLang, settings.business_name)}</h2>
              {settings.address && <p className="text-sm text-neutral-600 whitespace-pre-line mt-1">{settings.address}</p>}
              <p className="text-xs text-neutral-500 mt-1">
                {[settings.phone, settings.email].filter(Boolean).join(" · ")}
                {settings.vat_number && ` · ${L.vatLabel} ${num(settings.vat_number)}`}
              </p>
            </div>
            <div className="text-end">
              <h1 className="text-4xl font-display tracking-tight" style={{ color }}>{L.invoice}</h1>
              <p className="text-lg mt-1">{L.invoiceNumber}: {num(order.invoice_number)}</p>
              <p className="text-xs text-neutral-500 mt-2">{L.date}: {new Date(order.order_date).toLocaleDateString(isRTL ? "ar-BH" : undefined)}</p>
              <p className="text-xs text-neutral-500">{L.status}: {tStatus(order.status, invoiceLang)}</p>
              {order.payment_method && (
                <p className="text-xs text-neutral-500">{L.paymentMethod}: {tPayment(order.payment_method, invoiceLang)}</p>
              )}
            </div>
          </div>

          {order.customers && (
            <div className="mb-8 text-start">
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{L.billTo}</p>
              <p className="font-medium">{order.customers.name}</p>
              {order.customers.address && <p className="text-sm text-neutral-600 whitespace-pre-line">{order.customers.address}</p>}
              {order.customers.city && <p className="text-sm text-neutral-600">{order.customers.city}</p>}
              {order.customers.phone && <p className="text-sm text-neutral-600">{num(order.customers.phone)}</p>}
              {order.customers.email && <p className="text-sm text-neutral-600">{order.customers.email}</p>}
            </div>
          )}

          <table className="w-full text-sm mb-6">
            <thead>
              <tr style={{ backgroundColor: color, color: "white" }}>
                <th className="text-start p-3">{L.description}</th>
                <th className="text-end p-3 w-16">{L.qty}</th>
                <th className="text-end p-3 w-28">{L.unit}</th>
                <th className="text-end p-3 w-28">{L.total}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-neutral-200 align-top">
                  <td className="p-3 text-start">
                    <p className="font-medium">{it.description || "—"}</p>
                    {it.customizations.length > 0 && (
                      <ul className="mt-1 text-xs text-neutral-600 space-y-0.5">
                        {it.customizations.map((c, ci) => (
                          <li key={ci}>+ {c.name} ({money(c.price_delta)})</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="p-3 text-end">{num(it.quantity)}</td>
                  <td className="p-3 text-end">{money(it.unit_price + it.customization_total)}</td>
                  <td className="p-3 font-medium text-end">{money(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-72 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-neutral-600">{L.subtotal}</span><span>{money(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div className="flex justify-between"><span className="text-neutral-600">{L.discount}</span><span>− {money(order.discount)}</span></div>}
              {Number(order.tax_rate) > 0 && <div className="flex justify-between"><span className="text-neutral-600">{L.vat} ({num(order.tax_rate)}%)</span><span>{money(order.tax_amount)}</span></div>}
              {Number(order.shipping) > 0 && <div className="flex justify-between"><span className="text-neutral-600">{L.shipping}</span><span>{money(order.shipping)}</span></div>}
              <div className="flex justify-between pt-2 border-t-2" style={{ borderColor: color }}>
                <span className="font-display text-lg" style={{ color }}>{L.grandTotal}</span>
                <span className="font-display text-lg" style={{ color }}>{money(order.total)}</span>
              </div>
            </div>
          </div>


          {(order.notes || settings.footer_note) && (
            <div className="mt-10 pt-6 border-t border-neutral-200 text-sm text-neutral-600 space-y-2">
              {order.notes && <p><strong className="text-neutral-800">{L.notes}: </strong>{order.notes}</p>}
              {settings.footer_note && <p className="italic">{settings.footer_note}</p>}
              <p className="italic">{L.warmRegards},<br/>{brandFor(invoiceLang, settings.business_name)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Tpl = { id: string; name: string; channel: "email" | "whatsapp" | "both"; subject: string | null; body: string; is_default: boolean };

function renderTemplate(str: string, vars: Record<string, string>) {
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function defaultBody() {
  return `Hi {{customer_name}},

Thank you for your order with {{business_name}}. Please find your invoice details below:

Invoice #: {{invoice_number}}
Date: {{date}}
Total: {{total}}

Please let us know if you have any questions.

Warm regards,
{{business_name}}`;
}

function SendInvoiceDialog({ order, totals, settings, currency }: { order: any; totals: any; settings: any; currency: string }) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const qc = useQueryClient();

  const vars = useMemo(() => ({
    customer_name: order?.customers?.name ?? "there",
    customer_email: order?.customers?.email ?? "",
    customer_phone: order?.customers?.phone ?? "",
    business_name: brandFor("en", settings?.business_name),
    invoice_number: String(order?.invoice_number ?? ""),
    date: new Date(order?.order_date).toLocaleDateString(),
    total: formatMoney(totals.total, currency),
    notes: order?.notes ?? "",
  }), [order, totals, settings, currency]);

  const templatesQ = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Tpl[];
    },
  });

  const [selectedId, setSelectedId] = useState<string>("__default");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Refresh fields from customer + selected template whenever dialog opens or selection/order changes
  useEffect(() => {
    if (!open) return;
    setEmail(order?.customers?.email ?? "");
    setPhone(order?.customers?.phone ?? "");
    const tpl = templatesQ.data?.find((t) => t.id === selectedId);
    const rawSubject = tpl?.subject ?? `Invoice #{{invoice_number}} from {{business_name}}`;
    const rawBody = tpl?.body ?? defaultBody();
    setSubject(renderTemplate(rawSubject, vars).trim());
    setMessage(renderTemplate(rawBody, vars));
  }, [open, selectedId, templatesQ.data, vars]);

  // Auto-pick default template once loaded
  useEffect(() => {
    if (selectedId !== "__default") return;
    const def = templatesQ.data?.find((t) => t.is_default);
    if (def) setSelectedId(def.id);
  }, [templatesQ.data, selectedId]);

  const openEmail = () => {
    if (!email) return toast.error("This customer has no email on file — add it in Customers or type one here");
    const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = href;
  };

  const openWhatsApp = () => {
    const digits = (phone || "").replace(/[^\d]/g, "");
    if (!digits) return toast.error("This customer has no phone on file — add it in Customers or type one here (with country code)");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline"><Send className="h-4 w-4 mr-2" /> Send invoice</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send invoice</DialogTitle>
            <DialogDescription>Pick a template, tweak the message, then send via email or WhatsApp.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Template</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default">— Built-in default —</SelectItem>
                  {(templatesQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " ★" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>Manage</Button>
          </div>

          <Tabs defaultValue="email" className="mt-2">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="space-y-3 mt-4">
              <div>
                <Label>To (from customer)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea rows={10} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <DialogFooter>
                <Button onClick={openEmail}><Send className="h-4 w-4 mr-2" /> Open email app</Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="whatsapp" className="space-y-3 mt-4">
              <div>
                <Label>Phone (from customer — include country code)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966501234567" />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea rows={10} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Opens WhatsApp Web or the WhatsApp app with the message pre-filled — you send it manually. Attach the printed PDF there if needed.</p>
              <DialogFooter>
                <Button onClick={openWhatsApp}><Send className="h-4 w-4 mr-2" /> Open WhatsApp</Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ManageTemplatesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        templates={templatesQ.data ?? []}
        onChanged={() => qc.invalidateQueries({ queryKey: ["message-templates"] })}
      />
    </>
  );
}

function ManageTemplatesDialog({ open, onOpenChange, templates, onChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; templates: Tpl[]; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Partial<Tpl> | null>(null);

  const startNew = () => setEditing({ name: "", channel: "both", subject: "", body: defaultBody(), is_default: false });

  const save = async () => {
    if (!editing?.name || !editing?.body) return toast.error("Name and body are required");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: editing.name!,
      channel: editing.channel ?? "both",
      subject: editing.subject ?? null,
      body: editing.body!,
      is_default: !!editing.is_default,
    };
    // If setting as default, unset others first
    if (payload.is_default) {
      await supabase.from("message_templates").update({ is_default: false }).eq("user_id", user.id);
    }
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("message_templates").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("message_templates").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message templates</DialogTitle>
          <DialogDescription>
            Use placeholders like <code>{"{{customer_name}}"}</code>, <code>{"{{business_name}}"}</code>, <code>{"{{invoice_number}}"}</code>, <code>{"{{date}}"}</code>, <code>{"{{total}}"}</code>, <code>{"{{notes}}"}</code>.
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button size="sm" onClick={startNew}><Plus className="h-3 w-3 mr-1" /> New template</Button>
            </div>
            {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between border border-border rounded-md p-3">
                <div>
                  <p className="font-medium text-sm">{t.name} {t.is_default && <span className="text-xs text-primary">★ default</span>}</p>
                  <p className="text-xs text-muted-foreground">{t.channel}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Channel</Label>
                <Select value={editing.channel ?? "both"} onValueChange={(v) => setEditing({ ...editing, channel: v as Tpl["channel"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="email">Email only</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Email subject (optional)</Label>
              <Input value={editing.subject ?? ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea rows={12} value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!editing.is_default} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
              Use as default template
            </label>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>Save template</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

