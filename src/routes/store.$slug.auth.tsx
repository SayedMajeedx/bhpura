import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStorefront } from "@/lib/storefront-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, User, LogIn, MailCheck } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/store/$slug/auth")({
  component: StorefrontAuth,
});

function StorefrontAuth() {
  const { brand, settings, t, lang, session } = useStorefront();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [working, setWorking] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);

  if (session) {
    // Already signed in — bounce back to checkout / home
    navigate({ to: "/store/$slug", params: { slug: brand.slug } });
    return null;
  }

  const link = async (name: string, phone: string) => {
    try {
      await supabase.rpc("link_storefront_customer", {
        p_brand_slug: brand.slug,
        p_name: name || undefined,
        p_phone: phone || undefined,
      });

    } catch (e) {
      console.error("link customer failed", e);
    }
  };

  const signIn = async () => {
    if (!form.email || !form.password) {
      toast.error(t("البريد وكلمة المرور مطلوبان", "Email and password are required"));
      return;
    }
    setWorking(true);
    const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
    if (error) { setWorking(false); return toast.error(translateAuthError(error, lang as any)); }
    await link(form.name, form.phone);
    setWorking(false);
    toast.success(t("مرحبًا بعودتك!", "Welcome back!"));
    navigate({ to: "/store/$slug/checkout", params: { slug: brand.slug } });
  };

  const signUp = async () => {
    if (!form.email || !form.password) {
      toast.error(t("البريد وكلمة المرور مطلوبان", "Email and password are required"));
      return;
    }
    setWorking(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { name: form.name || undefined, phone: form.phone || undefined },
        emailRedirectTo: `${window.location.origin}/store/${brand.slug}`,
      },
    });
    if (error) { setWorking(false); return toast.error(translateAuthError(error, lang as any)); }
    setWorking(false);

    // If email confirmation is required, Supabase returns a user but no session.
    const needsVerify = !data.session;
    if (needsVerify) {
      setPendingVerification(form.email.trim());
      toast.success(
        t(
          "تحقق من بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول.",
          "Check your email to verify your account before signing in.",
        ),
        { duration: 8000 },
      );
      return;
    }

    // Already signed in (email confirmation disabled) — link + go to checkout.
    await link(form.name, form.phone);
    toast.success(t("تم إنشاء الحساب!", "Account created!"));
    navigate({ to: "/store/$slug/checkout", params: { slug: brand.slug } });
  };

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-10">
      <Card className="p-6 space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center" style={{ backgroundColor: `${settings.primary_color}15`, color: settings.primary_color }}>
            <User className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl">{t("حسابك في", "Your account at")} {brand.name_en}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("سجّل للحصول على متابعة سريعة لطلباتك", "Register for faster checkout and to track your orders")}
          </p>
        </div>

        {pendingVerification && (
          <div
            className="rounded-lg border-2 p-4 flex gap-3 items-start bg-white"
            style={{ borderColor: settings.primary_color, color: "#111827" }}
            role="status"
            aria-live="polite"
          >
            <MailCheck className="h-5 w-5 mt-0.5 shrink-0" style={{ color: settings.primary_color }} />
            <div className="text-sm space-y-1 text-slate-900">
              <div className="font-semibold text-base" style={{ color: settings.primary_color }}>
                {t("تحقّق من بريدك الإلكتروني", "Check your email")}
              </div>
              <div className="text-slate-800">
                {t("أرسلنا رسالة تفعيل إلى", "We've sent a verification link to")}{" "}
                <span className="font-mono font-semibold text-slate-900">{pendingVerification}</span>.{" "}
                {t(
                  "افتح الرسالة واضغط على الرابط لتفعيل حسابك ثم عُد لتسجيل الدخول.",
                  "Open it and click the link to activate your account, then come back to sign in.",
                )}
              </div>
              <button
                type="button"
                className="mt-1 underline text-xs font-medium"
                style={{ color: settings.primary_color }}
                onClick={() => { setPendingVerification(null); setTab("signin"); }}
              >
                {t("تسجيل الدخول الآن", "Go to sign in")}
              </button>
            </div>
          </div>
        )}



        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">{t("تسجيل الدخول", "Sign in")}</TabsTrigger>
            <TabsTrigger value="signup">{t("إنشاء حساب", "Create account")}</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-3 mt-4">
            <div>
              <Label>{t("البريد الإلكتروني", "Email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("كلمة المرور", "Password")}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <Button className="w-full h-11" style={{ backgroundColor: settings.primary_color, color: "#fff" }} onClick={signIn} disabled={working}>
              {working && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              <LogIn className="h-4 w-4 me-2" />
              {t("تسجيل الدخول", "Sign in")}
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-3 mt-4">
            <div>
              <Label>{t("الاسم الكامل", "Full name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{t("رقم الهاتف", "Phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>{t("البريد الإلكتروني", "Email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("كلمة المرور", "Password")}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <Button className="w-full h-11" style={{ backgroundColor: settings.primary_color, color: "#fff" }} onClick={signUp} disabled={working}>
              {working && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("إنشاء الحساب", "Create account")}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="text-center text-sm">
          <Link to="/store/$slug/checkout" params={{ slug: brand.slug }} className="underline text-muted-foreground">
            {t("متابعة كضيف", "Continue as guest")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
