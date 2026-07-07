import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Package, Users, ReceiptText, TrendingUp, CalendarDays, Trophy, Wallet, PiggyBank } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n";
import { useProfile } from "@/lib/profile-context";
import { useBrand } from "@/lib/brand-context";

export const Route = createFileRoute("/_authenticated/b/$slug/dashboard")({
  component: Dashboard,
});

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function startOfTodayISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function Dashboard() {
  const t = useT();
  const { lang } = useI18n();
  const { canViewFinancials } = useProfile();
  const { slug } = Route.useParams();
  const brand = useBrand();
  const brandId = brand.id;
  const locale = lang === "ar" ? "ar-BH" : "en-US";

  const { data } = useQuery({
    queryKey: ["dashboard-stats", brandId],
    queryFn: async () => {
      const [products, customers, orders, variants, items, expenses] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("brand_id", brandId),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("brand_id", brandId),
        supabase
          .from("orders")
          .select("total, currency, status, created_at, order_date, invoice_number, id, customers(name)")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false }),
        supabase.from("product_variants").select("stock").eq("brand_id", brandId),
        supabase.from("order_items").select("description, quantity").eq("brand_id", brandId),
        (supabase.from("expenses") as any).select("amount, expense_date").eq("brand_id", brandId),
      ]);

      const monthStart = startOfMonthISO();
      const todayStart = startOfTodayISO();

      const allOrders = (orders.data ?? []) as any[];
      const currency = allOrders[0]?.currency ?? "BHD";

      const revenueMonth = allOrders
        .filter((o) => new Date(o.created_at).toISOString() >= monthStart)
        .reduce((s, o) => s + Number(o.total || 0), 0);

      const ordersToday = allOrders.filter(
        (o) => new Date(o.created_at).toISOString() >= todayStart,
      ).length;

      const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total || 0), 0);

      const allExpenses = ((expenses as any).data ?? []) as { amount: number; expense_date: string }[];
      const totalExpenses = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const expensesMonth = allExpenses
        .filter((e) => new Date(e.expense_date).toISOString() >= monthStart)
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      const stock = (variants.data ?? []).reduce((s: number, v: any) => s + (v.stock ?? 0), 0);

      const tallies = new Map<string, number>();
      for (const it of (items.data ?? []) as any[]) {
        const key = (it.description || "").trim() || "—";
        tallies.set(key, (tallies.get(key) ?? 0) + Number(it.quantity || 0));
      }
      const topSelling = Array.from(tallies.entries())
        .filter(([, q]) => q > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([description, quantity]) => ({ description, quantity }));

      return {
        products: products.count ?? 0,
        customers: customers.count ?? 0,
        ordersCount: allOrders.length,
        revenue: totalRevenue,
        revenueMonth,
        ordersToday,
        currency,
        stock,
        recent: allOrders.slice(0, 5),
        topSelling,
        totalExpenses,
        expensesMonth,
        netProfit,
      };
    },
  });

  // Build stats array based on user role - financials only for admins
  const primary = [
    ...(canViewFinancials
      ? [
          {
            label: t("dashboard.revenueMonth"),
            value: data ? formatMoney(data.revenueMonth, data.currency, locale) : "—",
            icon: TrendingUp,
            financial: true,
          },
          {
            label: t("dashboard.totalExpenses"),
            value: data ? formatMoney(data.totalExpenses, data.currency, locale) : "—",
            icon: Wallet,
            financial: true,
          },
          {
            label: t("dashboard.netProfit"),
            value: data ? formatMoney(data.netProfit, data.currency, locale) : "—",
            icon: PiggyBank,
            hint: t("dashboard.netProfitFormula"),
            financial: true,
          },
        ]
      : []),
    {
      label: t("dashboard.ordersToday"),
      value: data ? String(data.ordersToday) : "—",
      icon: CalendarDays,
    },
    {
      label: t("dashboard.customers"),
      value: data ? String(data.customers) : "—",
      icon: Users,
    },
    {
      label: t("dashboard.unitsInStock"),
      value: data ? String(data.stock) : "—",
      icon: Package,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-display">{t("dashboard.title")}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {primary.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="text-2xl sm:text-3xl font-display mt-2 truncate">{s.value}</p>
                  {(s as any).hint && <p className="text-[10px] text-muted-foreground mt-1">{(s as any).hint}</p>}
                </div>
                <div className="h-10 w-10 shrink-0 rounded-full bg-secondary flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4 text-primary" />
            <h2 className="text-lg sm:text-xl font-display">{t("dashboard.topSelling")}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{t("dashboard.topSellingSubtitle")}</p>
          {(data?.topSelling ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.noTopSelling")}</p>
          ) : (
            <ul className="space-y-3">
              {data!.topSelling.map((row, i) => {
                const max = data!.topSelling[0]!.quantity || 1;
                const pct = Math.max(6, Math.round((row.quantity / max) * 100));
                return (
                  <li key={i}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                          {i + 1}
                        </span>
                        <span className="truncate text-sm font-medium">{row.description}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.quantity} {t("dashboard.unitsSold")}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <ReceiptText className="h-4 w-4 text-primary" />
            <h2 className="text-lg sm:text-xl font-display">{t("dashboard.recentOrders")}</h2>
          </div>
          {(data?.recent ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.noOrders")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data!.recent.map((o: any) => (
                <li key={o.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <Link to="/b/$slug/orders/$id" params={{ slug, id: o.id }} className="min-w-0 truncate">
                    <span className="text-primary font-medium">#{o.invoice_number}</span>
                    <span className="text-muted-foreground"> · {new Date(o.created_at).toLocaleDateString(locale)}</span>
                    {o.customers?.name && (
                      <span className="text-muted-foreground"> · {o.customers.name}</span>
                    )}
                  </Link>
                  <span className="shrink-0 font-medium">{formatMoney(Number(o.total), o.currency, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
