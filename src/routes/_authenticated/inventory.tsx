import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, TrendingUp, Wand2, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { useT, useI18n } from "@/lib/i18n";
import { ActivityLogList } from "@/components/activity-log-list";
import { BarcodeSvg, PrintLabelButton, printLabels, type LabelData } from "@/components/barcode-label";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

type Product = { id: string; name: string; description: string | null; category: string | null; image_url: string | null };
type Variant = {
  id: string; product_id: string; sku: string | null; size: string | null; color: string | null; fabric: string | null;
  cost_price: number; selling_price: number; stock: number;
  stock_main: number; stock_incubator: number; barcode: string | null;
};
type Customization = { id: string; name: string; price_delta: number };

function Inventory() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"products" | "customizations">("products");

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const variants = useQuery({
    queryKey: ["variants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants").select("*").order("created_at");
      if (error) throw error;
      return data as Variant[];
    },
  });

  const customizations = useQuery({
    queryKey: ["customizations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customization_options").select("*").order("name");
      if (error) throw error;
      return data as Customization[];
    },
  });

  const businessName = useQuery({
    queryKey: ["business-name"],
    queryFn: async () => {
      const { data } = await supabase.from("business_settings").select("business_name").maybeSingle();
      return data?.business_name ?? null;
    },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display">{t("inventory.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("inventory.subtitle")}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "products" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setTab("products")}
        >{t("inventory.products")}</button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "customizations" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          onClick={() => setTab("customizations")}
        >{t("inventory.customizations")}</button>
      </div>

      {tab === "products" ? (
        <ProductsSection
          products={products.data ?? []}
          variants={variants.data ?? []}
          businessName={businessName.data ?? null}
          onChanged={() => { qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["variants"] }); }}
        />
      ) : (
        <CustomizationsSection
          items={customizations.data ?? []}
          onChanged={() => qc.invalidateQueries({ queryKey: ["customizations"] })}
        />
      )}

      <div className="mt-8">
        <ActivityLogList scope="inventory" />
      </div>
    </div>
  );
}

function ProductsSection({ products, variants, businessName, onChanged }: { products: Product[]; variants: Variant[]; businessName: string | null; onChanged: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const del = async (id: string) => {
    if (!confirm(t("common.confirmDelete"))) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success(t("common.delete")); onChanged(); }
  };

  const isAr = useI18n().lang === "ar";

  const printAll = async () => {
    const labels: LabelData[] = [];
    const [{ data: freshProducts, error: productsError }, { data: freshVariants, error: variantsError }] = await Promise.all([
      supabase.from("products").select("id, name").order("created_at", { ascending: false }),
      supabase
        .from("product_variants")
        .select("product_id, barcode, size, color, selling_price")
        .not("barcode", "is", null)
        .order("created_at"),
    ]);

    if (productsError || variantsError) {
      toast.error(productsError?.message ?? variantsError?.message ?? (isAr ? "تعذر تحميل الباركودات" : "Could not load barcodes"));
      return;
    }

    const printableProducts = (freshProducts ?? products) as Pick<Product, "id" | "name">[];
    const printableVariants = (freshVariants ?? variants) as Pick<Variant, "product_id" | "barcode" | "size" | "color" | "selling_price">[];

    for (const p of printableProducts) {
      for (const v of printableVariants.filter((x) => x.product_id === p.id)) {
        if (!v.barcode) continue;
        labels.push({
          code: v.barcode,
          productName: p.name,
          size: v.size,
          color: v.color,
          price: v.selling_price,
          businessName,
        });
      }
    }
    if (labels.length === 0) {
      toast.error(isAr ? "لا توجد باركودات للطباعة" : "No barcodes to print");
      return;
    }
    printLabels(labels);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={printAll}>
          <Printer className="h-4 w-4 me-2" /> {isAr ? "طباعة كل الباركودات" : "Print all barcodes"}
        </Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 me-2" /> {t("inventory.newProduct")}</Button>
          </DialogTrigger>
          <ProductDialog product={editing} onSaved={() => { setOpen(false); setEditing(null); onChanged(); }} />
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("inventory.none")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((p) => {
            const pVariants = variants.filter((v) => v.product_id === p.id);
            const stockTotal = pVariants.reduce((s, v) => s + (v.stock ?? 0), 0);
            return (
              <Card key={p.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 flex-1">
                    {p.image_url && (
                      <img src={p.image_url} alt={p.name} className="w-20 h-24 object-cover rounded-md border border-border" />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-display">{p.name}</h3>
                      {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                      {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        {pVariants.length} {t("inventory.variantsCount")} · {stockTotal} {t("inventory.inStock")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => del(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <VariantList productId={p.id} productName={p.name} businessName={businessName} variants={pVariants} onChanged={onChanged} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductDialog({ product, onSaved }: { product: Product | null; onSaved: () => void }) {
  const t = useT();
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "",
    image_url: product?.image_url ?? "",
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error(t("inventory.name"));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { ...form, user_id: user.id };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(t("common.save")); onSaved(); }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{product ? t("inventory.editProduct") : t("inventory.newProduct")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>{t("inventory.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>{t("inventory.category")}</Label><Input placeholder={t("inventory.categoryPh")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div><Label>{t("inventory.imageUrl")}</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
        <div><Label>{t("inventory.description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save}>{t("common.save")}</Button></DialogFooter>
    </DialogContent>
  );
}

function VariantList({ productId, productName, businessName, variants, onChanged }: { productId: string; productName: string; businessName: string | null; variants: Variant[]; onChanged: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [adding, setAdding] = useState(false);
  const empty = {
    size: "", color: "", fabric: "", sku: "", barcode: "",
    cost_price: "0", selling_price: "0",
    stock_main: "0", stock_incubator: "0",
  };
  const [row, setRow] = useState(empty);

  const genBarcode = () => {
    const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PL-${Date.now().toString(36).toUpperCase().slice(-4)}${rnd}`;
  };

  const add = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("product_variants").insert({
      user_id: user.id, product_id: productId,
      size: row.size || null, color: row.color || null, fabric: row.fabric || null,
      sku: row.sku || null, barcode: row.barcode.trim() || null,
      cost_price: Number(row.cost_price), selling_price: Number(row.selling_price),
      stock_main: Number(row.stock_main), stock_incubator: Number(row.stock_incubator),
    });
    if (error) return toast.error(error.message);
    setRow(empty); setAdding(false); onChanged();
  };

  const update = async (v: Variant, patch: Partial<Variant>) => {
    const { error } = await supabase.from("product_variants").update(patch).eq("id", v.id);
    if (error) toast.error(error.message); else onChanged();
  };
  const del = async (id: string) => {
    if (!confirm(t("inventory.deleteVariantConfirm"))) return;
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  };

  const mainLabel = isAr ? "الرئيسي" : "Main";
  const incLabel = isAr ? "الحاضنة" : "Incubator";
  const barcodeLabel = isAr ? "الباركود" : "Barcode";

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-start text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pe-3 text-start">{t("inventory.size")}</th>
              <th className="py-2 pe-3 text-start">{t("inventory.color")}</th>
              <th className="py-2 pe-3 text-start">{t("inventory.fabric")}</th>
              <th className="py-2 pe-3 text-start">{t("inventory.sku")}</th>
              <th className="py-2 pe-3 text-start">{barcodeLabel}</th>
              <th className="py-2 pe-3 text-start">{t("inventory.cost")}</th>
              <th className="py-2 pe-3 text-start">{t("inventory.price")}</th>
              <th className="py-2 pe-3 text-start">{t("inventory.margin")}</th>
              <th className="py-2 pe-3 text-start">{mainLabel}</th>
              <th className="py-2 pe-3 text-start">{incLabel}</th>
              <th className="py-2 pe-3 text-start">{t("inventory.stock")}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const margin = v.selling_price > 0 ? ((v.selling_price - v.cost_price) / v.selling_price) * 100 : 0;
              return (
                <tr key={v.id} className="border-t border-border">
                  <td className="py-2 pe-3 text-start"><input className="bg-transparent w-16 outline-none text-start" defaultValue={v.size ?? ""} onBlur={(e) => update(v, { size: e.target.value || null })} /></td>
                  <td className="py-2 pe-3 text-start"><input className="bg-transparent w-20 outline-none text-start" defaultValue={v.color ?? ""} onBlur={(e) => update(v, { color: e.target.value || null })} /></td>
                  <td className="py-2 pe-3 text-start"><input className="bg-transparent w-20 outline-none text-start" defaultValue={v.fabric ?? ""} onBlur={(e) => update(v, { fabric: e.target.value || null })} /></td>
                  <td className="py-2 pe-3 text-start"><input className="bg-transparent w-24 outline-none text-start" defaultValue={v.sku ?? ""} onBlur={(e) => update(v, { sku: e.target.value || null })} /></td>
                  <td className="py-2 pe-3 text-start">
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex items-center gap-1">
                        <input
                          className="bg-transparent w-28 outline-none text-start font-mono text-xs"
                          placeholder={isAr ? "بدون" : "None"}
                          defaultValue={v.barcode ?? ""}
                          onBlur={(e) => update(v, { barcode: e.target.value.trim() || null })}
                        />
                        <button
                          type="button"
                          title={isAr ? "توليد باركود" : "Generate barcode"}
                          className="text-muted-foreground hover:text-primary"
                          onClick={() => update(v, { barcode: genBarcode() })}
                        >
                          <Wand2 className="h-3 w-3" />
                        </button>
                        {v.barcode && (
                          <PrintLabelButton
                            label={isAr ? "طباعة" : "Print"}
                            data={{
                              code: v.barcode,
                              productName,
                              size: v.size,
                              color: v.color,
                              price: v.selling_price,
                              businessName,
                            }}
                          />
                        )}
                      </div>
                      {v.barcode && (
                        <div className="rounded bg-white p-1 inline-block w-fit">
                          <BarcodeSvg value={v.barcode} height={32} width={1.2} fontSize={10} margin={0} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pe-3 text-start"><input type="number" step="0.01" className="bg-transparent w-20 outline-none text-start" defaultValue={v.cost_price} onBlur={(e) => update(v, { cost_price: Number(e.target.value) })} /></td>
                  <td className="py-2 pe-3 text-start"><input type="number" step="0.01" className="bg-transparent w-24 outline-none text-start" defaultValue={v.selling_price} onBlur={(e) => update(v, { selling_price: Number(e.target.value) })} /></td>
                  <td className="py-2 pe-3 text-primary"><span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{margin.toFixed(0)}%</span></td>
                  <td className="py-2 pe-3 text-start"><input type="number" className="bg-transparent w-16 outline-none text-start" defaultValue={v.stock_main ?? 0} onBlur={(e) => update(v, { stock_main: Number(e.target.value) })} /></td>
                  <td className="py-2 pe-3 text-start"><input type="number" className="bg-transparent w-16 outline-none text-start" defaultValue={v.stock_incubator ?? 0} onBlur={(e) => update(v, { stock_incubator: Number(e.target.value) })} /></td>
                  <td className="py-2 pe-3 text-start font-medium">{(v.stock_main ?? 0) + (v.stock_incubator ?? 0)}</td>
                  <td className="text-end"><Button variant="ghost" size="icon" onClick={() => del(v.id)}><Trash2 className="h-3 w-3" /></Button></td>
                </tr>
              );
            })}
            {adding && (
              <tr className="border-t border-border bg-secondary/40">
                <td className="py-2 pe-3"><Input className="h-8 w-16 text-start" value={row.size} onChange={(e) => setRow({ ...row, size: e.target.value })} /></td>
                <td className="py-2 pe-3"><Input className="h-8 w-20 text-start" value={row.color} onChange={(e) => setRow({ ...row, color: e.target.value })} /></td>
                <td className="py-2 pe-3"><Input className="h-8 w-20 text-start" value={row.fabric} onChange={(e) => setRow({ ...row, fabric: e.target.value })} /></td>
                <td className="py-2 pe-3"><Input className="h-8 w-24 text-start" value={row.sku} onChange={(e) => setRow({ ...row, sku: e.target.value })} /></td>
                <td className="py-2 pe-3">
                  <div className="inline-flex items-center gap-1">
                    <Input className="h-8 w-28 text-start font-mono text-xs" value={row.barcode} onChange={(e) => setRow({ ...row, barcode: e.target.value })} placeholder={isAr ? "اختياري" : "Optional"} />
                    <button type="button" className="text-muted-foreground hover:text-primary" onClick={() => setRow({ ...row, barcode: genBarcode() })}>
                      <Wand2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="py-2 pe-3"><Input className="h-8 w-20 text-start" type="number" step="0.01" value={row.cost_price} onChange={(e) => setRow({ ...row, cost_price: e.target.value })} /></td>
                <td className="py-2 pe-3"><Input className="h-8 w-24 text-start" type="number" step="0.01" value={row.selling_price} onChange={(e) => setRow({ ...row, selling_price: e.target.value })} /></td>
                <td></td>
                <td className="py-2 pe-3"><Input className="h-8 w-16 text-start" type="number" value={row.stock_main} onChange={(e) => setRow({ ...row, stock_main: e.target.value })} /></td>
                <td className="py-2 pe-3"><Input className="h-8 w-16 text-start" type="number" value={row.stock_incubator} onChange={(e) => setRow({ ...row, stock_incubator: e.target.value })} /></td>
                <td></td>
                <td className="py-2"><div className="flex gap-1 justify-end"><Button size="sm" onClick={add}>{t("common.save")}</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>×</Button></div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!adding && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3 me-1" /> {t("inventory.addVariant")}
        </Button>
      )}
    </div>
  );
}

function CustomizationsSection({ items, onChanged }: { items: Customization[]; onChanged: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");

  const add = async () => {
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("customization_options").insert({
      user_id: user.id, name, price_delta: Number(price),
    });
    if (error) toast.error(error.message);
    else { setName(""); setPrice("0"); onChanged(); }
  };
  const del = async (id: string) => {
    const { error } = await supabase.from("customization_options").delete().eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  };

  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground mb-4">{t("inventory.addonsIntro")}</p>
      <div className="flex gap-2 mb-4">
        <Input placeholder={t("inventory.addonName")} value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" step="0.01" className="w-32" placeholder={t("inventory.addonPrice")} value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("inventory.noAddons")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">+ {formatMoney(Number(i.price_delta))}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del(i.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
