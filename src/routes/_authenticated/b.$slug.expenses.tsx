import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n";
import { useBrand } from "@/lib/brand-context";

export const Route = createFileRoute("/_authenticated/b/$slug/expenses")({
  beforeLoad: async ({ params }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, email")
      .eq("id", user.id)
      .maybeSingle();

    const email = (user.email || "").toLowerCase();
    const isFixedSuperAdmin = email === "majeed@hotmail.it";
    const role = profile?.role;
    const status = profile?.status ?? "active";
    const allowed =
      isFixedSuperAdmin ||
      ((role === "admin" || role === "super_admin" || role === "brand_admin") && status === "active");

    if (!allowed) {
      throw redirect({ to: "/b/$slug/dashboard", params: { slug: params.slug } });
    }
  },
  component: ExpensesPage,
});

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  expense_date: string;
  notes: string | null;
};

function ExpensesPage() {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar-BH" : "en-US";
  const qc = useQueryClient();
  const brand = useBrand();
  const brandId = brand.id;

  const q = useQuery({
    queryKey: ["expenses", brandId],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.from("expenses") as any)
          .select("*")
          .eq("brand_id", brandId)
          .order("expense_date", { ascending: false });
        if (error) {
          console.error("[expenses] fetch error:", error);
          return [] as Expense[];
        }
        return (data ?? []) as Expense[];
      } catch (err) {
        console.error("[expenses] unexpected fetch error:", err);
        return [] as Expense[];
      }
    },
    retry: false,
  });

  const [editing, setEditing] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);

  const list = q.data ?? [];
  const currency = list[0]?.currency ?? "BHD";
  const total = useMemo(() => list.reduce((s, e) => s + Number(e.amount || 0), 0), [list]);

  const del = async (id: string) => {
    if (!confirm(t("expenses.deleteConfirm"))) return;
    const { error } = await (supabase.from("expenses") as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("common.delete"));
      qc.invalidateQueries({ queryKey: ["expenses"] });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display">{t("expenses.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("expenses.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 me-2" /> {t("expenses.add")}
            </Button>
          </DialogTrigger>
          <ExpenseDialog
            expense={editing}
            onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["expenses"] }); }}
          />
        </Dialog>
      </div>

      <Card className="p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">{t("expenses.total")}</span>
          </div>
          <span className="text-2xl font-display">{formatMoney(total, currency, locale)}</span>
        </div>
      </Card>

      {list.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("expenses.none")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("expenses.date")}</th>
                  <th className="p-3 text-start">{t("expenses.category")}</th>
                  <th className="p-3 text-start">{t("expenses.description")}</th>
                  <th className="p-3 text-end">{t("expenses.amount")}</th>
                  <th className="p-3 text-end w-24"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap">{new Date(e.expense_date).toLocaleDateString(locale)}</td>
                    <td className="p-3 font-medium">{e.category}</td>
                    <td className="p-3 text-muted-foreground">{e.description || "—"}</td>
                    <td className="p-3 text-end whitespace-nowrap font-medium">{formatMoney(Number(e.amount), e.currency, locale)}</td>
                    <td className="p-3 text-end whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => del(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

function ExpenseDialog({ expense, onSaved }: { expense: Expense | null; onSaved: () => void }) {
  const t = useT();
  const [form, setForm] = useState({
    category: expense?.category ?? "",
    description: expense?.description ?? "",
    amount: expense ? String(expense.amount) : "0",
    currency: expense?.currency ?? "BHD",
    expense_date: expense?.expense_date ?? new Date().toISOString().slice(0, 10),
    notes: expense?.notes ?? "",
  });

  const save = async () => {
    if (!form.category.trim()) return toast.error(t("expenses.category"));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id,
      category: form.category.trim(),
      description: form.description.trim() || null,
      amount: Number(form.amount) || 0,
      currency: form.currency,
      expense_date: form.expense_date,
      notes: form.notes.trim() || null,
    };
    const { error } = expense
      ? await (supabase.from("expenses") as any).update(payload).eq("id", expense.id)
      : await (supabase.from("expenses") as any).insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(t("common.save")); onSaved(); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{expense ? t("expenses.edit") : t("expenses.add")}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{t("expenses.category")}</Label>
          <Input placeholder={t("expenses.categoryPh")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <div>
          <Label>{t("expenses.description")}</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("expenses.amount")}</Label>
            <Input type="number" step="0.01" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <Label>{t("expenses.date")}</Label>
            <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>{t("expenses.notes")}</Label>
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save}>{t("common.save")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}