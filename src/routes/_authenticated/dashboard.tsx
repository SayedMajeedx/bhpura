import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Package, Users, ReceiptText, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const t = useT();
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [products, customers, orders, variants] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total, currency, status, created_at").order("created_at", { ascending: false }),
        supabase.from("product_variants").select("stock"),
      ]);
      const revenue = (orders.data ?? []).reduce((s, o) => s + Number(o.total), 0);
      const currency = orders.data?.[0]?.currency ?? "SAR";
      const stock = (variants.data ?? []).reduce((s, v) => s + (v.stock ?? 0), 0);
      return {
        products: products.count ?? 0,
        customers: customers.count ?? 0,
        ordersCount: orders.data?.length ?? 0,
        revenue, currency, stock,
        recent: (orders.data ?? []).slice(0, 5),
      };
    },
  });

  const stats = [
    { label: t("dashboard.revenue"), value: data ? formatMoney(data.revenue, data.currency) : "—", icon: TrendingUp },
    { label: t("dashboard.orders"), value: data?.ordersCount ?? "—", icon: ReceiptText },
    { label: t("dashboard.customers"), value: data?.customers ?? "—", icon: Users },
    { label: t("dashboard.unitsInStock"), value: data?.stock ?? "—", icon: Package },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display">{t("dashboard.title")}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-display mt-2">{s.value}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-display mb-4">{t("dashboard.recentOrders")}</h2>
        {(data?.recent ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.noOrders")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data!.recent.map((o: any, i: number) => (
              <li key={i} className="py-3 flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()} · {t(`status.${o.status}`)}
                </span>
                <span className="font-medium">{formatMoney(Number(o.total), o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
