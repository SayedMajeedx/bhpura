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
import { Languages } from "lucide-react";
import { applyRememberMe } from "@/lib/session-persistence";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        applyRememberMe(remember);
        toast.success(t("auth.accountCreated"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        applyRememberMe(remember);
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? t("auth.failed"));
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
          <h2 className="text-2xl font-display mb-6">
            {mode === "signin" ? t("auth.welcomeBack") : t("auth.createPortal")}
          </h2>
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
              {mode === "signin" && (
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t("auth.forgotPassword")}
                </Link>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.pleaseWait") : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>{t("auth.newHere")}{" "}
                <button className="text-primary underline" onClick={() => setMode("signup")}>
                  {t("auth.createAccount")}
                </button>
              </>
            ) : (
              <>{t("auth.haveAccount")}{" "}
                <button className="text-primary underline" onClick={() => setMode("signin")}>
                  {t("auth.signIn")}
                </button>
              </>
            )}
          </div>
        </Card>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">{t("auth.backHome")}</Link>
        </div>
      </div>
    </div>
  );
}
