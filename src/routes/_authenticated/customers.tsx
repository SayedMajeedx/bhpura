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

export const Route = createFileRoute("/_authenticated/customers")({
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
  road: string | null;
  house: string | null;
  flat: string | null;
};

type Address = {
  id: string;
  customer_id: string;
  label: string | null;
  region: string | null;
  road: string | null;
  house: string | null;
  flat: string | null;
  is_default: boolean;
};

function CustomersPage() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const addressesQ = useQuery({
    queryKey: ["customer_addresses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_addresses").select("*");
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
    <div className="p-8 max-w-6xl">
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
          <table className="w-full text-sm">
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
    region: customer?.region ?? "",
    road: customer?.road ?? "",
    house: customer?.house ?? "",
    flat: customer?.flat ?? "",
    notes: customer?.notes ?? "",
  });

  const save = async () => {
    if (!f.name.trim()) return toast.error(t("customers.name"));
    if (!f.region.trim() || !f.road.trim() || !f.house.trim()) {
      return toast.error(t("customers.requiredError"));
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const composedAddress = [f.road, f.house, f.flat].filter((v) => v && v.trim()).join(" · ");
    const payload = {
      name: f.name,
      phone: f.phone,
      email: f.email,
      notes: f.notes,
      region: f.region,
      road: f.road,
      house: f.house,
      flat: f.flat || null,
      city: f.region, // keep legacy column in sync
      address: composedAddress,
      user_id: user.id,
    };
    const { error } = customer
      ? await supabase.from("customers").update(payload).eq("id", customer.id)
      : await supabase.from("customers").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success(t("common.save"));
      qc.invalidateQueries({ queryKey: ["order"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      onSaved();
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{customer ? t("customers.editTitle") : t("customers.newTitle")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{t("customers.name")} <span className="text-destructive">*</span></Label>
          <Input className="text-start" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t("customers.phone")}</Label><Input className="text-start" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>{t("customers.email")}</Label><Input className="text-start" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div>
          <Label>{t("customers.region")} <span className="text-destructive">*</span></Label>
          <Select value={f.region} onValueChange={(v) => setF({ ...f, region: v })}>
            <SelectTrigger className="text-start"><SelectValue placeholder={t("customers.regionPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {BAHRAIN_REGIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{lang === "ar" ? r.ar : r.en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("customers.road")} <span className="text-destructive">*</span></Label>
            <Input className="text-start" placeholder={t("customers.roadPlaceholder")} value={f.road} onChange={(e) => setF({ ...f, road: e.target.value })} />
          </div>
          <div>
            <Label>{t("customers.house")} <span className="text-destructive">*</span></Label>
            <Input className="text-start" placeholder={t("customers.housePlaceholder")} value={f.house} onChange={(e) => setF({ ...f, house: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>{t("customers.flat")}</Label>
          <Input className="text-start" placeholder={t("customers.flatPlaceholder")} value={f.flat} onChange={(e) => setF({ ...f, flat: e.target.value })} />
        </div>
        <div><Label>{t("customers.notes")}</Label><Textarea className="text-start" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save}>{t("common.save")}</Button></DialogFooter>
    </DialogContent>
  );
}
