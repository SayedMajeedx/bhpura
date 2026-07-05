export type PaymentBadge = "paid" | "partial" | "unpaid" | "refunded";

export const PAYMENT_BADGE_VALUES: PaymentBadge[] = ["unpaid", "partial", "paid", "refunded"];

export function resolvePaymentStatus(
  manual: string | null | undefined,
  orderStatus: string | null | undefined,
  total: number,
  advance: number,
): PaymentBadge {
  if (manual === "paid" || manual === "partial" || manual === "unpaid" || manual === "refunded") {
    return manual;
  }
  return derivePaymentStatus(orderStatus, total, advance);
}

export function derivePaymentStatus(
  orderStatus: string | null | undefined,
  total: number,
  advance: number,
): PaymentBadge {
  const t = Number(total || 0);
  const a = Number(advance || 0);
  const remaining = +(t - a).toFixed(2);
  // Fully paid: remaining is exactly 0 (and there's a total), or manually marked paid with no outstanding balance
  if (t > 0 && remaining <= 0) return "paid";
  if (orderStatus === "paid" && remaining <= 0) return "paid";
  // Partial: some advance paid but still a remaining balance
  if (a > 0 && remaining > 0) return "partial";
  return "unpaid";
}

export const PAYMENT_BADGE_CLASSES: Record<PaymentBadge, string> = {
  paid: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  partial: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
  unpaid: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
  refunded: "bg-neutral-200 text-neutral-800 border-neutral-400 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-600",
};

export const PAYMENT_BADGE_KEY: Record<PaymentBadge, string> = {
  paid: "payStatus.paid",
  partial: "payStatus.partial",
  unpaid: "payStatus.unpaid",
  refunded: "payStatus.refunded",
};

export const PAYMENT_BADGE_LABEL: Record<PaymentBadge, { en: string; ar: string }> = {
  paid: { en: "Paid", ar: "مدفوع" },
  partial: { en: "Partially Paid", ar: "مدفوع جزئياً" },
  unpaid: { en: "Unpaid", ar: "غير مدفوع" },
  refunded: { en: "Refunded", ar: "مسترجع" },
};
