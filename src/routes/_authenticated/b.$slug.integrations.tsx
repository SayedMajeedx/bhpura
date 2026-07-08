import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plug, Plus, Pencil, Trash2, Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useT, useI18n } from "@/lib/i18n";
import { useBrand } from "@/lib/brand-context";

export const Route = createFileRoute("/_authenticated/b/$slug/integrations")({
  component: IntegrationsPage,
});

type Row = {
  id: string;
  brand_id: string;
  provider: string;
  base_url: string | null;
  api_key: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
};

const PROVIDER_PRESETS = [
  { value: "aramex", label: "Aramex" },
  { value: "posta_plus", label: "Posta Plus" },
  { value: "stripe", label: "Stripe" },
  { value: "tap", label: "Tap Payments" },
  { value: "benefit", label: "Benefit Pay" },
  { value: "custom", label: "Custom" },
];

function mask(v: string | null | undefined) {
  if (!v) return "—";
  if (v.length <= 8) return `${v[0] ?? "•"}${"•".repeat(Math.max(0, v.length - 2))}${v[v.length - 1] ?? "•"}`;
  return `${v.slice(0, 4)}${"•".repeat(6)}${v.slice(-4)}`;
}

function IntegrationsPage() {
  const t = useT();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const brand = useBrand();
  const brandId = brand.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ["integrations", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_credentials")
        .select("*")
        .eq("brand_id", brandId)
        .order("provider");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const del = async (id: string) => {
    if (!confirm(isAr ? "حذف هذا التكامل؟" : "Delete this integration?")) return;
    const { error } = await supabase.from("integration_credentials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("common.delete"));
    qc.invalidateQueries({ queryKey: ["integrations", brandId] });
  };

  const webhookBase = typeof window !== "undefined" ? `${window.location.origin}/api/public/webhooks` : "https://…/api/public/webhooks";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-1">
            <Plug className="h-3.5 w-3.5" /> {t("nav.integrations")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-display">{t("integrations.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("integrations.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 me-2" /> {t("integrations.new")}
            </Button>
          </DialogTrigger>
          <IntegrationDialog
            brandId={brandId}
            row={editing}
            onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["integrations", brandId] }); }}
          />
        </Dialog>
      </div>

      <Card className="p-3 mb-4 border-amber-500/40 bg-amber-500/5">
        <div className="flex items-start gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-600" />
          <p>{t("integrations.warning")}</p>
        </div>
      </Card>

      {q.data && q.data.length === 0 ? (
        <Card className="p-12 text-center">
          <Plug className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("integrations.none")}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(q.data ?? []).map((row) => {
            const isRevealed = !!reveal[row.id];
            const webhookUrl = `${webhookBase}/${row.provider}/${brandId}`;
            const preset = PROVIDER_PRESETS.find((p) => p.value === row.provider);
            return (
              <Card key={row.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg truncate">{preset?.label ?? row.provider}</div>
                    <div className="text-xs text-muted-foreground truncate">{row.base_url || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs uppercase tracking-wider px-2 py-1 rounded ${row.is_active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {row.is_active ? t("integrations.active") : isAr ? "معطّل" : "Off"}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(row); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(row.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <MaskedRow label={t("integrations.apiKey")} value={row.api_key} revealed={isRevealed} onToggle={() => setReveal((s) => ({ ...s, [row.id]: !isRevealed }))} />
                  <MaskedRow label={t("integrations.webhookSecret")} value={row.webhook_secret} revealed={isRevealed} onToggle={() => setReveal((s) => ({ ...s, [row.id]: !isRevealed }))} />
                </div>

                <div className="mt-3 pt-3 border-t border-border text-xs">
                  <p className="text-muted-foreground mb-1">{t("integrations.webhookHint")}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate bg-secondary/40 rounded px-2 py-1">{webhookUrl}</code>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(webhookUrl); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {row.notes && <p className="text-xs text-muted-foreground mt-3 italic">{row.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MaskedRow({ label, value, revealed, onToggle }: { label: string; value: string | null; revealed: boolean; onToggle: () => void }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <code className="flex-1 truncate bg-secondary/40 rounded px-2 py-1 text-xs">
          {revealed ? (value || "—") : mask(value)}
        </code>
        {value && (
          <Button variant="ghost" size="icon" onClick={onToggle}>
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function IntegrationDialog({ brandId, row, onSaved }: { brandId: string; row: Row | null; onSaved: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider: row?.provider ?? "aramex",
    provider_custom: row && !PROVIDER_PRESETS.find((p) => p.value === row.provider) ? row.provider : "",
    base_url: row?.base_url ?? "",
    api_key: row?.api_key ?? "",
    webhook_secret: row?.webhook_secret ?? "",
    is_active: row?.is_active ?? true,
    notes: row?.notes ?? "",
  });
  const providerValue = useMemo(() => form.provider === "custom" ? form.provider_custom.trim() : form.provider, [form.provider, form.provider_custom]);

  const save = async () => {
    if (!providerValue) return toast.error(isAr ? "اسم الخدمة مطلوب" : "Provider is required");
    setSaving(true);
    const payload = {
      brand_id: brandId,
      provider: providerValue,
      base_url: form.base_url.trim() || null,
      api_key: form.api_key.trim() || null,
      webhook_secret: form.webhook_secret.trim() || null,
      is_active: form.is_active,
      notes: form.notes.trim() || null,
    };
    let error;
    if (row) {
      ({ error } = await supabase.from("integration_credentials").update(payload).eq("id", row.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await (supabase.from("integration_credentials") as any).insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("common.save"));
    onSaved();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{row ? (isAr ? "تعديل التكامل" : "Edit integration") : t("integrations.new")}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{t("integrations.provider")}</Label>
          <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROVIDER_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {form.provider === "custom" && (
            <Input className="mt-2" placeholder={isAr ? "اسم الخدمة" : "Custom provider name"}
              value={form.provider_custom} onChange={(e) => setForm({ ...form, provider_custom: e.target.value })} />
          )}
        </div>
        <div>
          <Label>{t("integrations.baseUrl")}</Label>
          <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.provider.com" />
        </div>
        <div>
          <Label>{t("integrations.apiKey")}</Label>
          <Input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk_live_…" />
        </div>
        <div>
          <Label>{t("integrations.webhookSecret")}</Label>
          <Input value={form.webhook_secret} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })} placeholder="whsec_…" />
        </div>
        <div>
          <Label>{t("integrations.notes")}</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex items-center justify-between border border-border rounded-md p-3">
          <p className="text-sm font-medium">{t("integrations.active")}</p>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{t("common.save")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
