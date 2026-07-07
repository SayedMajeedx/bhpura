import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, MessageCircle, Search, Megaphone, Save, Trash2, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useBrand } from "@/lib/brand-context";

export const Route = createFileRoute("/_authenticated/b/$slug/campaigns")({
  component: CampaignsPage,
});

type Customer = { id: string; name: string; phone: string | null };
type Template = { id: string; name: string; body: string };

const CHANNEL = "whatsapp";
const DEFAULT_EN = "Hi {{customer_name}}, this is {{business_name}}. We have exciting news for you!";
const DEFAULT_AR = "مرحبًا {{customer_name}}، معكم {{business_name}}. لدينا عرض مميز لك!";

function CampaignsPage() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();
  const brand = useBrand();
  const brandId = brand.id;

  const [message, setMessage] = useState(isAr ? DEFAULT_AR : DEFAULT_EN);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveMode, setSaveMode] = useState<"new" | "update">("new");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const templatesQ = useQuery({
    queryKey: ["campaign-templates", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, name, body")
        .eq("brand_id", brandId)
        .eq("channel", CHANNEL)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const customersQ = useQuery({
    queryKey: ["campaigns-customers", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("brand_id", brandId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const ordersQ = useQuery({
    queryKey: ["campaigns-order-counts", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("customer_id").eq("brand_id", brandId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((o: { customer_id: string | null }) => {
        if (o.customer_id) counts[o.customer_id] = (counts[o.customer_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const businessQ = useQuery({
    queryKey: ["campaigns-business", brandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_settings")
        .select("business_name")
        .eq("brand_id", brandId)
        .maybeSingle();
      return data?.business_name ?? "";
    },
  });
  const businessName = businessQ.data ?? "";

  const onSelectTemplate = (id: string) => {
    setSelectedId(id);
    const tpl = (templatesQ.data ?? []).find((t) => t.id === id);
    if (tpl) setMessage(tpl.body);
  };

  const openSave = (mode: "new" | "update") => {
    const current = (templatesQ.data ?? []).find((t) => t.id === selectedId);
    if (mode === "update" && !current) {
      toast.error(isAr ? "اختر قالبًا لتحديثه" : "Select a template to update");
      return;
    }
    setSaveMode(mode);
    setSaveName(mode === "update" && current ? current.name : "");
    setSaveOpen(true);
  };

  const saveTemplate = async () => {
    const name = saveName.trim();
    if (!name) return toast.error(isAr ? "أدخل اسم القالب" : "Enter a template name");
    if (!message.trim()) return toast.error(isAr ? "الرسالة فارغة" : "Message is empty");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (saveMode === "update" && selectedId) {
      const { error } = await supabase
        .from("message_templates")
        .update({ name, body: message })
        .eq("id", selectedId);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("message_templates")
        .insert({ name, body: message, channel: CHANNEL, user_id: user.id } as any)
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      if (data) setSelectedId(data.id);
    }
    toast.success(isAr ? "تم الحفظ" : "Saved");
    setSaveOpen(false);
    qc.invalidateQueries({ queryKey: ["campaign-templates"] });
  };

  const deleteTemplate = async () => {
    if (!selectedId) return;
    const tpl = (templatesQ.data ?? []).find((t) => t.id === selectedId);
    if (!tpl) return;
    if (!confirm(isAr ? `حذف قالب "${tpl.name}"؟` : `Delete template "${tpl.name}"?`)) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", selectedId);
    if (error) return toast.error(error.message);
    toast.success(isAr ? "تم الحذف" : "Deleted");
    setSelectedId("");
    qc.invalidateQueries({ queryKey: ["campaign-templates"] });
  };

  const insertPlaceholder = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setMessage((m) => m + token);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const filtered = useMemo(() => {
    const list = customersQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customersQ.data, search]);

  const buildMessage = (customerName: string) =>
    message
      .replaceAll("{{customer_name}}", customerName || "")
      .replaceAll("{{business_name}}", businessName || "");

  const send = (c: Customer) => {
    if (!c.phone || !c.phone.trim()) {
      toast.error(isAr ? "لا يوجد رقم هاتف" : "No phone number on file");
      return;
    }
    const phone = c.phone.replace(/[^\d]/g, "");
    if (!phone) {
      toast.error(isAr ? "رقم الهاتف غير صالح" : "Invalid phone number");
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(c.name))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent((s) => ({ ...s, [c.id]: true }));
  };

  // Persist "sent" checkmarks per session, resets when template/message changes materially? Keep in-memory.
  useEffect(() => {
    // keep sent state across renders; user has a Reset button.
  }, []);

  const templates = templatesQ.data ?? [];
  const placeholders: { label: string; token: string }[] = [
    { label: isAr ? "اسم العميل" : "Customer name", token: "{{customer_name}}" },
    { label: isAr ? "اسم النشاط" : "Business name", token: "{{business_name}}" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-4xl font-display">
            {isAr ? "حملات الواتساب" : "WhatsApp Campaigns"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAr
              ? "أرسل رسائل تسويقية مخصصة إلى عملائك عبر الواتساب."
              : "Broadcast personalized marketing messages to your customers via WhatsApp."}
          </p>
        </div>
      </div>

      <Card className="p-4 sm:p-6 mb-6 space-y-4">
        {/* Template picker + actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 min-w-0">
            <Label className="text-sm font-medium">
              {isAr ? "اختر قالب الرسالة" : "Select Template"}
            </Label>
            <Select value={selectedId || undefined} onValueChange={onSelectTemplate}>
              <SelectTrigger className="mt-1 text-start">
                <SelectValue
                  placeholder={
                    templates.length === 0
                      ? isAr
                        ? "لا توجد قوالب محفوظة بعد"
                        : "No saved templates yet"
                      : isAr
                        ? "اختر قالبًا..."
                        : "Choose a template..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openSave("new")}>
              <Plus className="h-4 w-4 me-2" />
              {isAr ? "قالب جديد" : "New"}
            </Button>
            <Button variant="outline" onClick={() => openSave("update")} disabled={!selectedId}>
              <Save className="h-4 w-4 me-2" />
              {isAr ? "حفظ القالب" : "Save Template"}
            </Button>
            <Button variant="ghost" onClick={deleteTemplate} disabled={!selectedId}>
              <Trash2 className="h-4 w-4 me-2 text-destructive" />
              {isAr ? "حذف" : "Delete"}
            </Button>
          </div>
        </div>

        {/* Message body */}
        <div>
          <Label className="text-sm font-medium">
            {isAr ? "نص الرسالة" : "Broadcast message"}
          </Label>
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="text-start mt-1"
            dir={isAr ? "rtl" : "ltr"}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isAr ? "أدرج متغير:" : "Insert placeholder:"}
            </span>
            {placeholders.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => insertPlaceholder(p.token)}
                className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {p.label} <code className="opacity-70">{p.token}</code>
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          <span className="font-medium">{isAr ? "معاينة:" : "Preview:"}</span>{" "}
          <span className="text-foreground">
            {buildMessage(filtered[0]?.name ?? (isAr ? "العميل" : "Customer"))}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث عن عميل..." : "Search customer..."}
              className="ps-9 text-start"
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {Object.values(sent).filter(Boolean).length}/{filtered.length}{" "}
              {isAr ? "مرسلة" : "sent"}
            </span>
            {Object.keys(sent).length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSent({})}>
                {isAr ? "إعادة تعيين" : "Reset"}
              </Button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {isAr ? "لا يوجد عملاء." : "No customers found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="p-4 font-medium text-start">{isAr ? "الاسم" : "Name"}</th>
                  <th className="p-4 font-medium text-start">{isAr ? "الهاتف" : "Phone"}</th>
                  <th className="p-4 font-medium text-start">
                    {isAr ? "إجمالي الطلبات" : "Total Orders"}
                  </th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isSent = !!sent[c.id];
                  const orderCount = ordersQ.data?.[c.id] ?? 0;
                  return (
                    <tr
                      key={c.id}
                      className={`border-t border-border transition-colors ${
                        isSent ? "bg-emerald-500/10" : ""
                      }`}
                    >
                      <td className="p-4 font-medium">{c.name}</td>
                      <td className="p-4 text-muted-foreground" dir="ltr">
                        {c.phone || "—"}
                      </td>
                      <td className="p-4 text-muted-foreground">{orderCount}</td>
                      <td className="p-4 text-end">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium">
                            <Check className="h-3 w-3" /> {isAr ? "تم الإرسال" : "Sent"}
                          </span>
                        ) : (
                          <Button size="sm" onClick={() => send(c)} disabled={!c.phone}>
                            <MessageCircle className="h-4 w-4 me-2" />
                            {isAr ? "إرسال عبر الواتساب" : "Send via WhatsApp"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {saveMode === "update"
                ? isAr ? "تحديث القالب" : "Update template"
                : isAr ? "حفظ قالب جديد" : "Save new template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{isAr ? "اسم القالب" : "Template name"}</Label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={isAr ? "مثال: عرض العيد" : "e.g. Eid promo"}
                className="text-start"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {isAr ? "المحتوى:" : "Body:"}
              <div className="mt-1 p-2 rounded bg-secondary text-foreground max-h-32 overflow-auto whitespace-pre-wrap">
                {message || "—"}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={saveTemplate}>{isAr ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
