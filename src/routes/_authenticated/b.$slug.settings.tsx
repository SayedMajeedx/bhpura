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

        <div className="flex justify-end"><Button onClick={save}>{t("settings.save")}</Button></div>
      </div>
    </div>
  );
}
