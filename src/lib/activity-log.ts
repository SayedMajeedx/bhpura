import { supabase } from "@/integrations/supabase/client";

export type ActivityLog = {
  id: string;
  order_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  action: string;
  message_en: string;
  message_ar: string;
  metadata: Record<string, any>;
  created_at: string;
};

type LogInput = {
  action: string;
  en: string;
  ar: string;
  order_id?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  metadata?: Record<string, any>;
};

export async function logActivity(input: LogInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase.from("activity_logs") as any).insert({
    user_id: user.id,
    order_id: input.order_id ?? null,
    product_id: input.product_id ?? null,
    variant_id: input.variant_id ?? null,
    action: input.action,
    message_en: input.en,
    message_ar: input.ar,
    metadata: input.metadata ?? {},
  });
}

export async function logActivityBatch(inputs: LogInput[]) {
  if (inputs.length === 0) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await (supabase.from("activity_logs") as any).insert(
    inputs.map((i) => ({
      user_id: user.id,
      order_id: i.order_id ?? null,
      product_id: i.product_id ?? null,
      variant_id: i.variant_id ?? null,
      action: i.action,
      message_en: i.en,
      message_ar: i.ar,
      metadata: i.metadata ?? {},
    })),
  );
}