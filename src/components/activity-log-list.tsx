import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { History } from "lucide-react";
import { useI18n, useT } from "@/lib/i18n";
import type { ActivityLog } from "@/lib/activity-log";

type Props = {
  orderId?: string;
  productId?: string;
  variantIds?: string[];
  scope?: "order" | "product" | "inventory";
  limit?: number;
  brandId?: string;
};

export function ActivityLogList({ orderId, productId, variantIds, scope = "order", limit = 50, brandId }: Props) {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar-BH" : "en-US";

  const q = useQuery({
    queryKey: ["activity_logs", { orderId, productId, variantIds, scope, limit, brandId }],
    queryFn: async () => {
      let query: any = (supabase.from("activity_logs") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (brandId) query = query.eq("brand_id", brandId);
      if (orderId) query = query.eq("order_id", orderId);
      else if (productId) query = query.eq("product_id", productId);
      else if (scope === "inventory") {
        // All inventory-related logs (stock changes, product/variant edits)
        query = query.in("action", [
          "stock_change",
          "stock_manual",
          "variant_create",
          "variant_delete",
          "product_create",
          "product_update",
          "product_delete",
        ]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
  });

  const logs = q.data ?? [];

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-lg sm:text-xl font-display">{t("activity.title")}</h2>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
      ) : (
        <ol className="relative border-s border-border ms-2 space-y-4">
          {logs.map((l) => (
            <li key={l.id} className="ms-4">
              <span className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
              <p className="text-sm">{lang === "ar" ? l.message_ar : l.message_en}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(l.created_at).toLocaleString(locale)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}