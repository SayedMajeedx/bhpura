import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: OrdersList,
});

function OrdersList() {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const create = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: settings } = await supabase.from("business_settings").select("*").eq("user_id", user.id).maybeSingle();
    const nextNum = settings?.next_invoice_number ?? 1001;
    const currency = settings?.currency ?? "SAR";
    const taxRate = settings?.default_tax_rate ?? 15;
    const { data: order, error } = await supabase.from("orders").insert({
      user_id: user.id, invoice_number: nextNum, currency, tax_rate: taxRate,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("business_settings").update({ next_invoice_number: nextNum + 1 }).eq("user_id", user.id);
    navigate({ to: "/orders/$id", params: { id: order.id } });
  };

  const del = async (id: string) => {
    if (!confirm(t("orders.deleteConfirm"))) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("common.delete")); qc.invalidateQueries({ queryKey: ["orders"] }); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display">{t("orders.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("orders.subtitle")}</p>
        </div>
        <Button onClick={create}><Plus className="h-4 w-4 mr-2" /> {t("orders.new")}</Button>
      </div>

      {(data ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <ReceiptText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("orders.none")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-left">
                <th className="p-4 font-medium">{t("orders.invoice")}</th>
                <th className="p-4 font-medium">{t("orders.date")}</th>
                <th className="p-4 font-medium">{t("orders.customer")}</th>
                <th className="p-4 font-medium">{t("orders.status")}</th>
                <th className="p-4 font-medium text-right">{t("orders.total")}</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {data!.map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="p-4">
                    <Link to="/orders/$id" params={{ id: o.id }} className="text-primary font-medium">
                      #{o.invoice_number}
                    </Link>
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(o.order_date).toLocaleDateString()}</td>
                  <td className="p-4">{o.customers?.name ?? <span className="text-muted-foreground italic">{t("orders.noCustomer")}</span>}</td>
                  <td className="p-4"><span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-secondary">{t(`status.${o.status}`)}</span></td>
                  <td className="p-4 text-right font-medium">{formatMoney(Number(o.total), o.currency)}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => del(o.id)}><Trash2 className="h-4 w-4" /></Button>
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
