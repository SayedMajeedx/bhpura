import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useT, useI18n } from "@/lib/i18n";
import { PhoneInput } from "@/components/phone-input";
import { Rnd } from "react-rnd";
import { useBrand } from "@/lib/brand-context";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/b/$slug/settings")({
  component: Settings,
});

type Settings = {
  user_id: string;
  business_name: string; logo_url: string | null; address: string | null;
  phone: string | null; email: string | null; vat_number: string | null;
  currency: string; default_tax_rate: number; primary_color: string;
  footer_note: string | null; next_invoice_number: number;
  font_family: string; font_url: string | null; font_size: number;
  text_color: string; background_color: string; logo_size: number;
  logo_x: number; logo_y: number; logo_width: number; logo_height: number;
};

const LOGO_CANVAS_W = 600;
const LOGO_CANVAS_H = 220;

const FONT_PRESETS = [
  "Cormorant Garamond", "Playfair Display", "Inter", "Roboto",
  "Lato", "Montserrat", "Open Sans", "Poppins", "Georgia",
  "Times New Roman", "Arial", "Helvetica", "Custom (uploaded)",
];

const LONG_TTL = 60 * 60 * 24 * 365 * 10; // 10 years

async function uploadToBucket(userId: string, file: File, kind: "logo" | "font"): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("invoice-assets").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data, error: se } = await supabase.storage.from("invoice-assets").createSignedUrl(path, LONG_TTL);
  if (se || !data) throw se ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

function Settings() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const brand = useBrand();
  const brandId = brand.id;
  const brandDisplayName = (lang === "ar" ? brand.name_ar : brand.name_en) || brand.name_en || brand.slug;
  const LEGACY_NAMES = new Set(["My Abaya Boutique", "متجر عباياتي", ""]);
  const logoInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<null | "logo" | "font">(null);

  const { data } = useQuery({
    queryKey: ["business-settings", brandId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from("business_settings").select("*").eq("brand_id", brandId).maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: created, error: e2 } = await (supabase.from("business_settings") as any).insert({ user_id: user.id, brand_id: brandId }).select().single();
        if (e2) throw e2;
        return created as Settings;
      }
      return data as Settings;
    },
  });

  const [f, setF] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) {
      const trimmed = (data.business_name ?? "").trim();
      const name = LEGACY_NAMES.has(trimmed) ? brandDisplayName : trimmed;
      setF({ ...data, business_name: name });
    }
  }, [data, brandDisplayName]);

  if (!f) return <div className="p-8">Loading…</div>;

  const save = async () => {
    const { error } = await supabase.from("business_settings").update({
      business_name: f.business_name, logo_url: f.logo_url, address: f.address, phone: f.phone,
      email: f.email, vat_number: f.vat_number, currency: f.currency,
      default_tax_rate: f.default_tax_rate, primary_color: f.primary_color, footer_note: f.footer_note,
      font_family: f.font_family, font_url: f.font_url, font_size: f.font_size,
      text_color: f.text_color, background_color: f.background_color, logo_size: f.logo_size,
      logo_x: f.logo_x, logo_y: f.logo_y, logo_width: f.logo_width, logo_height: f.logo_height,
    }).eq("brand_id", brandId);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["business-settings"] }); }
  };

  const handleUpload = async (file: File, kind: "logo" | "font") => {
    try {
      setUploading(kind);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const url = await uploadToBucket(user.id, file, kind);
      if (kind === "logo") setF({ ...f, logo_url: url });
      else setF({ ...f, font_url: url, font_family: "Custom (uploaded)" });
      toast.success(`${kind === "logo" ? "Logo" : "Font"} uploaded — remember to save`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const previewFont = f.font_family === "Custom (uploaded)" ? "'CustomFont', sans-serif" : `"${f.font_family}", sans-serif`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {f.font_url && (
        <style>{`@font-face { font-family: 'CustomFont'; src: url('${f.font_url}'); font-display: swap; }`}</style>
      )}
      <h1 className="text-4xl font-display mb-2">{t("settings.title")}</h1>
      <p className="text-muted-foreground mb-6">{t("settings.subtitle")}</p>

      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl">{t("settings.business")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>{t("settings.businessName")}</Label><Input value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} /></div>
            <div>
              <Label>{t("settings.logo")}</Label>
              <div className="flex gap-2">
                <Input value={f.logo_url ?? ""} placeholder="https://..." onChange={(e) => setF({ ...f, logo_url: e.target.value })} />
                <input ref={logoInput} type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")} />
                <Button type="button" variant="outline" size="icon" onClick={() => logoInput.current?.click()} disabled={uploading === "logo"}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div><Label>{t("settings.address")}</Label><Textarea value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>{t("settings.phone")}</Label><PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></div>
            <div><Label>{t("settings.email")}</Label><Input value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div><Label>{t("settings.vat")}</Label><Input value={f.vat_number ?? ""} onChange={(e) => setF({ ...f, vat_number: e.target.value })} /></div>
            <div><Label>{t("settings.currency")}</Label><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></div>
            <div><Label>{t("settings.defaultVat")}</Label><Input type="number" step="0.01" value={f.default_tax_rate} onChange={(e) => setF({ ...f, default_tax_rate: Number(e.target.value) })} /></div>
          </div>
          <div><Label>{t("settings.footer")}</Label><Textarea placeholder={t("settings.footerPh")} value={f.footer_note ?? ""} onChange={(e) => setF({ ...f, footer_note: e.target.value })} /></div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-display text-xl">{t("settings.appearance")}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("settings.fontFamily")}</Label>
              <Select value={f.font_family} onValueChange={(v) => setF({ ...f, font_family: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_PRESETS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("settings.uploadFont")}</Label>
              <div className="flex gap-2">
                <Input readOnly value={f.font_url ? t("settings.uploaded") : ""} placeholder={t("settings.noFile")} />
                <input ref={fontInput} type="file" accept=".woff,.woff2,.ttf,.otf" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "font")} />
                <Button type="button" variant="outline" size="icon" onClick={() => fontInput.current?.click()} disabled={uploading === "font"}>
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>{t("settings.fontSize")}</Label>
              <Input type="number" min={10} max={24} value={f.font_size} onChange={(e) => setF({ ...f, font_size: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("settings.logoHeight")}</Label>
              <Input type="number" min={24} max={200} value={f.logo_size} onChange={(e) => setF({ ...f, logo_size: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("settings.accent")}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("settings.textColor")}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={f.text_color} onChange={(e) => setF({ ...f, text_color: e.target.value })} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={f.text_color} onChange={(e) => setF({ ...f, text_color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("settings.bgColor")}</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={f.background_color} onChange={(e) => setF({ ...f, background_color: e.target.value })} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={f.background_color} onChange={(e) => setF({ ...f, background_color: e.target.value })} />
              </div>
            </div>
          </div>

          <div
            className="rounded-md border border-border p-6 mt-2"
            style={{ backgroundColor: f.background_color, color: f.text_color, fontFamily: previewFont, fontSize: `${f.font_size}px` }}
          >
            <div style={{ borderTop: `4px solid ${f.primary_color}`, marginBottom: 12 }} />
            {f.logo_url && <img src={f.logo_url} alt="logo" style={{ height: f.logo_size, objectFit: "contain", marginBottom: 8 }} />}
            <div style={{ color: f.primary_color, fontSize: `${f.font_size * 1.6}px`, fontWeight: 600 }}>
              {f.business_name || t("settings.businessName")}
            </div>
            <p style={{ marginTop: 6 }}>{t("settings.previewText")}</p>
          </div>
        </Card>

        {f.logo_url && (
          <Card className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl">Invoice logo position &amp; size</h2>
                <p className="text-sm text-muted-foreground">
                  Drag the logo to reposition it and drag any corner to resize. This will be applied to every invoice.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setF({ ...f, logo_x: 0, logo_y: 0, logo_width: 160, logo_height: 64 })
                }
              >
                Reset
              </Button>
            </div>

            <div
              className="relative mx-auto border border-dashed border-border rounded-md bg-white overflow-hidden"
              style={{ width: LOGO_CANVAS_W, height: LOGO_CANVAS_H }}
            >
              <Rnd
                size={{ width: f.logo_width, height: f.logo_height }}
                position={{ x: f.logo_x, y: f.logo_y }}
                onDragStop={(_e, d) => setF({ ...f, logo_x: d.x, logo_y: d.y })}
                onResizeStop={(_e, _dir, ref, _delta, pos) =>
                  setF({
                    ...f,
                    logo_width: parseInt(ref.style.width, 10),
                    logo_height: parseInt(ref.style.height, 10),
                    logo_x: pos.x,
                    logo_y: pos.y,
                  })
                }
                bounds="parent"
                lockAspectRatio
                className="border border-dashed border-neutral-300 hover:border-neutral-500"
              >
                <img
                  src={f.logo_url}
                  alt="logo"
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
                />
              </Rnd>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><Label>X</Label><Input type="number" value={f.logo_x} onChange={(e) => setF({ ...f, logo_x: Number(e.target.value) })} /></div>
              <div><Label>Y</Label><Input type="number" value={f.logo_y} onChange={(e) => setF({ ...f, logo_y: Number(e.target.value) })} /></div>
              <div><Label>Width</Label><Input type="number" value={f.logo_width} onChange={(e) => setF({ ...f, logo_width: Number(e.target.value) })} /></div>
              <div><Label>Height</Label><Input type="number" value={f.logo_height} onChange={(e) => setF({ ...f, logo_height: Number(e.target.value) })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Remember to click Save below to persist changes.</p>
          </Card>
        )}

        <ShippingSettingsCard brandId={brandId} />
        <PaymentSettingsCard brandId={brandId} />
        <BrandHeroCard brandId={brandId} />


        <div className="flex justify-end"><Button onClick={save}>{t("settings.save")}</Button></div>

      </div>
    </div>
  );
}

type MediaItem = { type: "image" | "video"; url: string };

function PaymentSettingsCard({ brandId }: { brandId: string }) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();
  const qrInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<{
    cod_enabled: boolean; card_enabled: boolean; benefit_enabled: boolean; benefit_qr_url: string | null;
  } | null>(null);

  const { data } = useQuery({
    queryKey: ["business-settings-payments", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings")
        .select("cod_enabled, card_enabled, benefit_enabled, benefit_qr_url")
        .eq("brand_id", brandId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (data) setState({
      cod_enabled: data.cod_enabled ?? true,
      card_enabled: data.card_enabled ?? false,
      benefit_enabled: data.benefit_enabled ?? false,
      benefit_qr_url: data.benefit_qr_url ?? null,
    });
  }, [data]);

  const save = async () => {
    if (!state) return;
    setSaving(true);
    const { error } = await supabase.from("business_settings").update(state).eq("brand_id", brandId);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(isAr ? "تم الحفظ" : "Saved"); qc.invalidateQueries({ queryKey: ["business-settings-payments", brandId] }); }
  };

  const uploadQr = async (file: File) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/brand-media/benefit-qr-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("invoice-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: se } = await supabase.storage.from("invoice-assets").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (se || !data) throw se ?? new Error("Failed to sign URL");
      setState((s) => (s ? { ...s, benefit_qr_url: data.signedUrl } : s));
      toast.success(isAr ? "تم رفع الرمز — لا تنسَ الحفظ" : "QR uploaded — remember to save");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  if (!state) return null;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="font-display text-xl">{isAr ? "إعدادات الدفع" : "Payment Settings"}</h2>
        <p className="text-sm text-muted-foreground">{isAr ? "التحكم بوسائل الدفع المتاحة للعملاء في المتجر" : "Control which payment methods are shown to storefront customers"}</p>
      </div>

      {[
        { key: "cod_enabled" as const, ar: "الدفع عند الاستلام", en: "Cash on Delivery" },
        { key: "card_enabled" as const, ar: "بطاقة ائتمان", en: "Card Payment" },
        { key: "benefit_enabled" as const, ar: "بنفت باي (Benefit Pay)", en: "Benefit Pay" },
      ].map((row) => (
        <div key={row.key} className="flex items-center justify-between rounded-md border border-border p-3">
          <p className="text-sm font-medium">{isAr ? row.ar : row.en}</p>
          <Switch checked={state[row.key]} onCheckedChange={(v) => setState({ ...state, [row.key]: v })} />
        </div>
      ))}

      {state.benefit_enabled && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <Label>{isAr ? "رمز QR لبنفت باي" : "Benefit Pay QR image"}</Label>
          <div className="flex items-center gap-3">
            {state.benefit_qr_url && (
              <img src={state.benefit_qr_url} alt="QR" className="w-24 h-24 object-contain border border-border rounded" />
            )}
            <div className="flex gap-2">
              <input ref={qrInput} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])} />
              <Button type="button" variant="outline" size="sm" onClick={() => qrInput.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 me-1" /> {uploading ? "…" : isAr ? "رفع" : "Upload"}
              </Button>
              {state.benefit_qr_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setState({ ...state, benefit_qr_url: null })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>{isAr ? "حفظ إعدادات الدفع" : "Save payment settings"}</Button>
      </div>
    </Card>
  );
}

function BrandHeroCard({ brandId }: { brandId: string }) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<{ hero_media: MediaItem[]; primary_color: string | null; about_ar: string | null; about_en: string | null } | null>(null);

  const { data } = useQuery({
    queryKey: ["brand-hero", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands")
        .select("hero_media, primary_color, about_ar, about_en").eq("id", brandId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) setState({
      hero_media: Array.isArray(data.hero_media) ? (data.hero_media as any) : [],
      primary_color: data.primary_color ?? null,
      about_ar: data.about_ar ?? null,
      about_en: data.about_en ?? null,
    });
  }, [data]);

  const uploadMedia = async (file: File) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/brand-media/hero-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("invoice-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: se } = await supabase.storage.from("invoice-assets").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (se || !data) throw se ?? new Error("Failed to sign URL");
      const type: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
      setState((s) => (s ? { ...s, hero_media: [...s.hero_media, { type, url: data.signedUrl }] } : s));
      toast.success(isAr ? "تم الرفع — لا تنسَ الحفظ" : "Uploaded — remember to save");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!state) return;
    setSaving(true);
    const { error } = await supabase.from("brands").update({
      hero_media: state.hero_media as any,
      primary_color: state.primary_color,
      about_ar: state.about_ar,
      about_en: state.about_en,
    }).eq("id", brandId);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(isAr ? "تم الحفظ" : "Saved"); qc.invalidateQueries({ queryKey: ["brand-hero", brandId] }); }
  };

  if (!state) return null;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="font-display text-xl">{isAr ? "واجهة المتجر" : "Storefront Hero"}</h2>
        <p className="text-sm text-muted-foreground">{isAr ? "الصور/الفيديو والنبذة التي يراها العملاء في الصفحة الرئيسية" : "Hero media, brand color, and About text shown on the public storefront home"}</p>
      </div>

      <div className="space-y-2">
        <Label>{isAr ? "وسائط الواجهة" : "Hero media"}</Label>
        <div className="flex flex-wrap gap-2">
          {state.hero_media.map((m, i) => (
            <div key={i} className="relative w-28 h-20 rounded-md border border-border overflow-hidden bg-secondary">
              {m.type === "video" ? (
                <video src={m.url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              )}
              <button type="button" className="absolute top-0.5 end-0.5 bg-background/80 rounded-full p-0.5"
                onClick={() => setState({ ...state, hero_media: state.hero_media.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <label className="w-28 h-20 rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-secondary">
            {uploading ? "…" : (isAr ? "+ إضافة" : "+ Add")}
            <input type="file" accept="image/*,video/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0])} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{isAr ? "لون العلامة" : "Brand color"}</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={state.primary_color ?? "#000000"}
              onChange={(e) => setState({ ...state, primary_color: e.target.value })}
              className="h-9 w-12 rounded border border-border cursor-pointer" />
            <Input value={state.primary_color ?? ""} onChange={(e) => setState({ ...state, primary_color: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{isAr ? "نبذة (عربي)" : "About (Arabic)"}</Label>
          <Textarea value={state.about_ar ?? ""} onChange={(e) => setState({ ...state, about_ar: e.target.value })} />
        </div>
        <div>
          <Label>{isAr ? "نبذة (إنجليزي)" : "About (English)"}</Label>
          <Textarea value={state.about_en ?? ""} onChange={(e) => setState({ ...state, about_en: e.target.value })} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>{isAr ? "حفظ واجهة المتجر" : "Save storefront hero"}</Button>
      </div>
    </Card>
  );
}

function ShippingSettingsCard({ brandId }: { brandId: string }) {
  const t = useT();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<{ delivery_enabled: boolean; pickup_enabled: boolean; delivery_fee: number } | null>(null);

  const { data } = useQuery({
    queryKey: ["business-settings-shipping", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings")
        .select("delivery_enabled, pickup_enabled, delivery_fee")
        .eq("brand_id", brandId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (data) setState({
      delivery_enabled: (data as any).delivery_enabled ?? true,
      pickup_enabled: (data as any).pickup_enabled ?? true,
      delivery_fee: Number((data as any).delivery_fee ?? 0),
    });
  }, [data]);

  const save = async () => {
    if (!state) return;
    setSaving(true);
    const { error } = await (supabase.from("business_settings") as any).update({
      delivery_enabled: state.delivery_enabled,
      pickup_enabled: state.pickup_enabled,
      delivery_fee: state.delivery_fee,
    }).eq("brand_id", brandId);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(isAr ? "تم الحفظ" : "Saved"); qc.invalidateQueries({ queryKey: ["business-settings-shipping", brandId] }); }
  };

  if (!state) return null;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="font-display text-xl">{t("settings.shippingTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.shippingSubtitle")}</p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <p className="text-sm font-medium">{t("settings.deliveryEnabled")}</p>
        <Switch checked={state.delivery_enabled} onCheckedChange={(v) => setState({ ...state, delivery_enabled: v })} />
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <p className="text-sm font-medium">{t("settings.pickupEnabled")}</p>
        <Switch checked={state.pickup_enabled} onCheckedChange={(v) => setState({ ...state, pickup_enabled: v })} />
      </div>

      <div>
        <Label>{t("settings.deliveryFee")}</Label>
        <Input
          type="number"
          step="0.01"
          min={0}
          value={state.delivery_fee}
          onChange={(e) => setState({ ...state, delivery_fee: Math.max(0, Number(e.target.value)) })}
          disabled={!state.delivery_enabled}
        />
        <p className="text-xs text-muted-foreground mt-1">{t("settings.deliveryFeeHint")}</p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>{t("settings.save")}</Button>
      </div>
    </Card>
  );
}

