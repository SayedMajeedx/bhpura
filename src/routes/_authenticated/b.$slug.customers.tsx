import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Users, Star, Check } from "lucide-react";
import { toast } from "sonner";
import { useT, useI18n } from "@/lib/i18n";
import { BAHRAIN_REGIONS, regionLabel, formatAddressLine, type StructuredAddress } from "@/lib/bahrain-regions";
import { PhoneInput } from "@/components/phone-input";
import { useBrand } from "@/lib/brand-context";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";

export const Route = createFileRoute("/_authenticated/b/$slug/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  region: string | null;
  block: string | null;
  road: string | null;
  house: string | null;
  flat: string | null;
};

type Address = {
  id: string;
  customer_id: string;
  label: string | null;
  region: string | null;
  block: string | null;
  road: string | null;
  house: string | null;
  flat: string | null;
  is_default: boolean;
};


function CustomersPage() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const brand = useBrand();
  const brandId = brand.id;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  useRealtimeInvalidate(
    [
      { table: "customers", brandId, queryKey: ["customers", brandId] },
      { table: "customer_addresses", brandId, queryKey: ["customer_addresses", brandId] },
    ],
    `customers-list-${brandId}`,
  );

  const { data } = useQuery({
    queryKey: ["customers", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("brand_id", brandId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const addressesQ = useQuery({
    queryKey: ["customer_addresses", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_addresses").select("*").eq("brand_id", brandId);
      if (error) throw error;
      return data as Address[];
    },
  });
  const defaultByCustomer = new Map<string, Address>();
  (addressesQ.data ?? []).forEach((a) => {
    if (a.is_default) defaultByCustomer.set(a.customer_id, a);
  });

  const del = async (id: string) => {
    if (!confirm(t("customers.deleteConfirm"))) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("common.delete")); qc.invalidateQueries({ queryKey: ["customers"] }); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display">{t("customers.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("customers.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" /> {t("customers.new")}</Button>
          </DialogTrigger>
          <CustomerDialog
            customer={editing}
            onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["customers"] }); }}
          />
        </Dialog>
      </div>

      {(data ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("customers.none")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-left">
                <th className="p-4 font-medium">{t("customers.name")}</th>
                <th className="p-4 font-medium">{t("customers.contact")}</th>
                <th className="p-4 font-medium">{t("customers.region")}</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {data!.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-4"><p className="font-medium">{c.name}</p>{c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}</td>
                  <td className="p-4 text-muted-foreground">
                    {c.phone && <div>{c.phone}</div>}
                    {c.email && <div>{c.email}</div>}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {(() => {
                      const def = defaultByCustomer.get(c.id);
                      if (def) return formatAddressLine(def, lang) || regionLabel(def.region, lang) || "—";
                      return regionLabel(c.region, lang) || c.city || "—";
                    })()}
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CustomerDialog({ customer, onSaved }: { customer: Customer | null; onSaved: () => void }) {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    notes: customer?.notes ?? "",
  });

  // For NEW customers we require one initial address inside the dialog.
  const [initialAddr, setInitialAddr] = useState({ label: "", region: "", block: "", road: "", house: "", flat: "" });

  const addressesQ = useQuery({
    queryKey: ["customer_addresses", customer?.id ?? "new"],
    queryFn: async () => {
      if (!customer) return [] as Address[];
      const { data, error } = await supabase.from("customer_addresses").select("*").eq("customer_id", customer.id).order("created_at");
      if (error) throw error;
      return data as Address[];
    },
    enabled: !!customer,
  });

  const save = async () => {
    if (!f.name.trim()) return toast.error(t("customers.name"));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!customer) {
      if (!initialAddr.region.trim() || !initialAddr.block.trim() || !initialAddr.road.trim() || !initialAddr.house.trim()) {
        return toast.error(t("customers.requiredError"));
      }
      const composedAddress = [
        initialAddr.block && `Block ${initialAddr.block}`,
        initialAddr.road && `Road ${initialAddr.road}`,
        initialAddr.house && `House ${initialAddr.house}`,
        initialAddr.flat && `Flat ${initialAddr.flat}`,
      ].filter(Boolean).join(" · ");
      const { data: created, error } = await (supabase.from("customers") as any).insert({
        name: f.name, phone: f.phone, email: f.email, notes: f.notes,
        region: initialAddr.region, block: initialAddr.block,
        road: initialAddr.road, house: initialAddr.house, flat: initialAddr.flat || null,
        city: initialAddr.region, address: composedAddress,
        user_id: user.id,
      }).select("id").single();
      if (error || !created) return toast.error(error?.message ?? "Failed");
      const { error: aerr } = await (supabase.from("customer_addresses") as any).insert({
        user_id: user.id, customer_id: created.id, label: initialAddr.label || "Primary",
        region: initialAddr.region, block: initialAddr.block,
        road: initialAddr.road, house: initialAddr.house, flat: initialAddr.flat || null,
        is_default: true,
      });
      if (aerr) return toast.error(aerr.message);
    } else {

      const { error } = await supabase.from("customers").update({
        name: f.name, phone: f.phone, email: f.email, notes: f.notes,
      }).eq("id", customer.id);
      if (error) return toast.error(error.message);
    }
    toast.success(t("common.save"));
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["customer_addresses"] });
    qc.invalidateQueries({ queryKey: ["order"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{customer ? t("customers.editTitle") : t("customers.newTitle")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{t("customers.name")} <span className="text-destructive">*</span></Label>
          <Input className="text-start" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>{t("customers.phone")}</Label><PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></div>
          <div><Label>{t("customers.email")}</Label><Input className="text-start" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div><Label>{t("customers.notes")}</Label><Textarea className="text-start" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>

        <div className="pt-3 border-t border-border">
          <h3 className="font-medium mb-2">{t("customers.addresses")}</h3>
          {!customer ? (
            <AddressFields value={initialAddr} onChange={setInitialAddr} lang={lang} />
          ) : (
            <AddressManager customerId={customer.id} addresses={addressesQ.data ?? []} lang={lang} />
          )}
        </div>
      </div>
      <DialogFooter><Button onClick={save}>{t("common.save")}</Button></DialogFooter>
    </DialogContent>
  );
}

function AddressFields({
  value, onChange, lang, showLabel = true,
}: {
  value: { label: string; region: string; block: string; road: string; house: string; flat: string };
  onChange: (v: { label: string; region: string; block: string; road: string; house: string; flat: string }) => void;
  lang: "en" | "ar";
  showLabel?: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      {showLabel && (
        <div>
          <Label>{t("customers.addressLabel")}</Label>
          <Input className="text-start" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        </div>
      )}
      <div>
        <Label>{t("customers.region")} <span className="text-destructive">*</span></Label>
        <Select value={value.region} onValueChange={(v) => onChange({ ...value, region: v })}>
          <SelectTrigger className="text-start"><SelectValue placeholder={t("customers.regionPlaceholder")} /></SelectTrigger>
          <SelectContent>
            {BAHRAIN_REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{lang === "ar" ? r.ar : r.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>{t("customers.block")} <span className="text-destructive">*</span></Label>
          <Input className="text-start" placeholder={t("customers.blockPlaceholder")} value={value.block} onChange={(e) => onChange({ ...value, block: e.target.value })} />
        </div>
        <div>
          <Label>{t("customers.road")} <span className="text-destructive">*</span></Label>
          <Input className="text-start" placeholder={t("customers.roadPlaceholder")} value={value.road} onChange={(e) => onChange({ ...value, road: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>{t("customers.house")} <span className="text-destructive">*</span></Label>
          <Input className="text-start" placeholder={t("customers.housePlaceholder")} value={value.house} onChange={(e) => onChange({ ...value, house: e.target.value })} />
        </div>
        <div>
          <Label>{t("customers.flat")}</Label>
          <Input className="text-start" placeholder={t("customers.flatPlaceholder")} value={value.flat} onChange={(e) => onChange({ ...value, flat: e.target.value })} />
        </div>
      </div>
    </div>
  );
}


function AddressManager({ customerId, addresses, lang }: { customerId: string; addresses: Address[]; lang: "en" | "ar" }) {
  const t = useT();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ label: "", region: "", block: "", road: "", house: "", flat: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customer_addresses"] });
    qc.invalidateQueries({ queryKey: ["customer_addresses", customerId] });
    qc.invalidateQueries({ queryKey: ["order"] });
  };

  const setDefault = async (id: string) => {
    await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", customerId);
    const { error } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("customers.setDefault"));
    invalidate();
  };

  const remove = async (id: string) => {
    if (!confirm(t("customers.deleteAddressConfirm"))) return;
    const { error } = await supabase.from("customer_addresses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const saveDraft = async () => {
    if (!draft.region.trim() || !draft.block.trim() || !draft.road.trim() || !draft.house.trim()) {
      return toast.error(t("customers.requiredError"));
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id, customer_id: customerId,
      label: draft.label || null,
      region: draft.region, block: draft.block,
      road: draft.road, house: draft.house, flat: draft.flat || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("customer_addresses").update(payload).eq("id", editingId));
    } else {
      const shouldBeDefault = addresses.length === 0;
      ({ error } = await (supabase.from("customer_addresses") as any).insert({ ...payload, is_default: shouldBeDefault }));
    }
    if (error) return toast.error(error.message);
    setAdding(false); setEditingId(null);
    setDraft({ label: "", region: "", block: "", road: "", house: "", flat: "" });
    invalidate();
  };

  const startEdit = (a: Address) => {
    setEditingId(a.id); setAdding(true);
    setDraft({
      label: a.label ?? "", region: a.region ?? "",
      block: a.block ?? "", road: a.road ?? "",
      house: a.house ?? "", flat: a.flat ?? "",
    });
  };


  return (
    <div className="space-y-3">
      {addresses.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic">{t("customers.noAddresses")}</p>
      )}
      <ul className="space-y-2">
        {addresses.map((a) => (
          <li key={a.id} className="flex items-start gap-2 border border-border rounded-md p-3">
            <div className="flex-1 min-w-0 text-start">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{a.label || t("customers.address")}</p>
                {a.is_default && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                    <Star className="h-3 w-3" /> {t("customers.default")}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{formatAddressLine(a as StructuredAddress, lang) || "—"}</p>
            </div>
            <div className="flex items-center gap-1">
              {!a.is_default && (
                <Button variant="ghost" size="sm" onClick={() => setDefault(a.id)} title={t("customers.setDefault")}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => startEdit(a)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="border border-border rounded-md p-3 space-y-3">
          <AddressFields value={draft} onChange={setDraft} lang={lang} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setEditingId(null); setDraft({ label: "", region: "", block: "", road: "", house: "", flat: "" }); }}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={saveDraft}>{t("common.save")}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 me-1" /> {t("customers.addAddress")}
        </Button>
      )}
    </div>
  );
}
