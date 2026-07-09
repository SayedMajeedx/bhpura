import { Link, useRouterState, useNavigate, useParams } from "@tanstack/react-router";
import { LayoutDashboard, Package, Users, ReceiptText, Settings, LogOut, Languages, Menu, Wallet, Megaphone, Shield, Store, Crown, Plug, Tags, FileText } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useProfile } from "@/lib/profile-context";

type BrandRow = { id: string; slug: string; name_en: string; is_active: boolean };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, isAdmin, isSuperAdmin, isLoading, profileError, signOutAndRedirect } = useProfile();

  // Extract slug from current URL when inside /b/:slug/*
  const routeParams = useParams({ strict: false }) as { slug?: string };
  const urlSlug = routeParams?.slug ?? null;

  // Fallback: use the user's own brand slug when we're outside /b/:slug (e.g. on /brands)
  const activeSlug = urlSlug ?? profile?.brand?.slug ?? null;

  // close drawer when route changes
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Force-logout only if profile exists and is explicitly inactive
  useEffect(() => {
    if (isLoading) return;
    if (profile && profile.status === "inactive") {
      (async () => { await signOutAndRedirect(); })();
    }
  }, [isLoading, profile, signOutAndRedirect]);

  // Super admin: load all brands for the switcher
  const brandsQ = useQuery({
    queryKey: ["brands-switcher"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, slug, name_en, is_active")
        .order("name_en");
      if (error) throw error;
      return (data ?? []) as BrandRow[];
    },
    enabled: isSuperAdmin,
  });

  // Build brand-prefixed nav items. If no active slug, links go to /dashboard (redirector).
  const nav = useMemo(() => {
    const items: { to: string; params?: any; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [];
    if (activeSlug) {
      items.push(
        { to: "/admin/b/$slug/dashboard", params: { slug: activeSlug }, label: t("nav.dashboard"), icon: LayoutDashboard },
        { to: "/admin/b/$slug/inventory", params: { slug: activeSlug }, label: t("nav.inventory"), icon: Package },
        { to: "/admin/b/$slug/categories", params: { slug: activeSlug }, label: lang === "ar" ? "الأقسام" : "Categories", icon: Tags },
        { to: "/admin/b/$slug/customers", params: { slug: activeSlug }, label: t("nav.customers"), icon: Users },
        { to: "/admin/b/$slug/campaigns", params: { slug: activeSlug }, label: lang === "ar" ? "حملات الواتساب" : "WhatsApp Campaigns", icon: Megaphone },
        { to: "/admin/b/$slug/orders", params: { slug: activeSlug }, label: t("nav.orders"), icon: ReceiptText },
        { to: "/admin/b/$slug/expenses", params: { slug: activeSlug }, label: t("nav.expenses"), icon: Wallet, adminOnly: true },
      );
      if (isAdmin) {
        items.push({ to: "/admin/b/$slug/team", params: { slug: activeSlug }, label: lang === "ar" ? "إدارة الموظفين" : "Team Management", icon: Shield });
        items.push({ to: "/admin/b/$slug/integrations", params: { slug: activeSlug }, label: t("nav.integrations"), icon: Plug });
      }
      items.push({ to: "/admin/b/$slug/pages", params: { slug: activeSlug }, label: lang === "ar" ? "الصفحات والسياسات" : "Pages & Policies", icon: FileText });
      items.push({ to: "/admin/b/$slug/settings", params: { slug: activeSlug }, label: t("nav.settings"), icon: Settings });

    }
    return items.filter((item) => !item.adminOnly || isAdmin);
  }, [t, lang, isAdmin, activeSlug]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const brandLabel = profile?.brand?.[lang === "ar" ? "name_ar" : "name_en"] ?? profile?.brand?.name_en ?? t("app.title");

  const SidebarContent = (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-display text-primary leading-tight">{brandLabel}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t("app.subtitle")}</p>
      </div>

      {isSuperAdmin && (
        <div className="p-3 border-b border-sidebar-border space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs uppercase tracking-wider text-primary">
            <Crown className="h-3.5 w-3.5" />
            {lang === "ar" ? "المدير الأعلى" : "Super Admin"}
          </div>
          <Select
            value={activeSlug ?? ""}
            onValueChange={(v) => navigate({ to: "/admin/b/$slug/dashboard", params: { slug: v } })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={lang === "ar" ? "اختر علامة" : "Select a brand"} />
            </SelectTrigger>
            <SelectContent>
              {(brandsQ.data ?? []).map((b) => (
                <SelectItem key={b.id} value={b.slug}>
                  {b.name_en}{!b.is_active ? " (inactive)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            to="/admin/brands"
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
              pathname === "/admin/brands"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Store className="h-3.5 w-3.5" />
            {lang === "ar" ? "إدارة العلامات" : "Manage brands"}
          </Link>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to.replace("$slug", item.params?.slug ?? ""));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as any}
              params={item.params}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <Select value={lang} onValueChange={(v) => setLang(v as "en" | "ar")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> {t("nav.signOut")}
        </Button>
      </div>
    </>
  );

  // SECURITY: fail closed. If we're done loading and still have no profile,
  // the account has no confirmed role/brand — don't render the admin shell
  // or any of its data-fetching children.
  if (!isLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-display text-primary">
            {lang === "ar" ? "الحساب بانتظار الإعداد" : "Account pending setup"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "ar"
              ? "لم يتم العثور على صلاحيات لحسابك بعد. يرجى التواصل مع المسؤول العام لإعداد حسابك."
              : "We couldn't confirm your access role yet. Please contact the super admin to finish setting up your account."}
          </p>
          {profileError && (
            <p className="text-xs text-muted-foreground/70">
              {lang === "ar" ? "حدث خطأ أثناء التحقق." : "There was an error verifying your account."}
            </p>
          )}
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> {t("nav.signOut")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="no-print hidden md:flex w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-col">
        {SidebarContent}
      </aside>

      <div className="md:hidden no-print fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-3 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={lang === "ar" ? "right" : "left"} className="p-0 w-72 flex flex-col bg-sidebar text-sidebar-foreground">
            <SheetTitle className="sr-only">{brandLabel}</SheetTitle>
            {SidebarContent}
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-display text-primary">{brandLabel}</h1>
        <div className="w-9" />
      </div>

      <main className="flex-1 overflow-auto print-area pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
