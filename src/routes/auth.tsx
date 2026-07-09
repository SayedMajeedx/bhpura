import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, ShieldCheck } from "lucide-react";
import { applyRememberMe } from "@/lib/session-persistence";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      applyRememberMe(remember);
      await new Promise((r) => setTimeout(r, 100));
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(translateAuthError(err, lang as any));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <Select value={lang} onValueChange={(v) => setLang(v as "en" | "ar")}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display text-primary">{t("app.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("app.portalSubtitle")}</p>
        </div>
        <Card className="p-8">
          <h2 className="text-2xl font-display mb-2">{t("auth.welcomeBack")}</h2>
          <p className="text-sm text-muted-foreground mb-6 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>
              {lang === "ar"
                ? "الوصول للوحة التحكم بالدعوة فقط. يقوم المسؤول العام بإنشاء حسابات مسؤولي المتاجر، ويمكن لكل مسؤول متجر إضافة موظفيه من قسم الفريق."
                : "Access is invite-only. The super admin creates brand admin accounts, and each brand admin can add staff from the Team section."}
            </span>
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                <span>{t("auth.rememberMe")}</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                {t("auth.forgotPassword")}
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.pleaseWait") : t("auth.signIn")}
            </Button>
          </form>
        </Card>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">{t("auth.backHome")}</Link>
        </div>
      </div>
    </div>
  );
}
