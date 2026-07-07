import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Package, Users, ReceiptText, Settings, LogOut, Languages, Menu, Wallet, Megaphone, Shield } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useProfile } from "@/lib/profile-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, isAdmin, isLoading, signOutAndRedirect } = useProfile();

  // close drawer when route changes
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Force-logout only if profile exists and is explicitly inactive
  // (not for users without profiles - they get treated as active admin)
  useEffect(() => {
    if (isLoading) return;
    if (profile && profile.status === "inactive") {
      (async () => {
        await signOutAndRedirect();
      })();
    }
  }, [isLoading, profile, signOutAndRedirect]);


  // Build nav items based on role
  const nav = useMemo(() => {
    const items: { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
      { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
      { to: "/inventory", label: t("nav.inventory"), icon: Package },
      { to: "/customers", label: t("nav.customers"), icon: Users },
      { to: "/campaigns", label: lang === "ar" ? "حملات الواتساب" : "WhatsApp Campaigns", icon: Megaphone },
      { to: "/orders", label: t("nav.orders"), icon: ReceiptText },
      { to: "/expenses", label: t("nav.expenses"), icon: Wallet, adminOnly: true },
      { to: "/settings", label: t("nav.settings"), icon: Settings },
    ];
    // Team Management only for admins
    if (isAdmin) {
      const teamNav = { to: "/team", label: lang === "ar" ? "إدارة الموظفين" : "Team Management", icon: Shield };
      // Insert before settings
      const settingsIdx = items.findIndex((i) => i.to === "/settings");
      if (settingsIdx >= 0) {
        items.splice(settingsIdx, 0, teamNav);
      } else {
        items.push(teamNav);
      }
    }
    // Filter out admin-only items if not admin
    return items.filter((item) => !item.adminOnly || isAdmin);
  }, [t, lang, isAdmin]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const SidebarContent = (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-display text-primary leading-tight">{t("app.title")}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t("app.subtitle")}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="no-print hidden md:flex w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-col">
        {SidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden no-print fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-3 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={lang === "ar" ? "right" : "left"} className="p-0 w-72 flex flex-col bg-sidebar text-sidebar-foreground">
            <SheetTitle className="sr-only">{t("app.title")}</SheetTitle>
            {SidebarContent}
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-display text-primary">{t("app.title")}</h1>
        <div className="w-9" />
      </div>

      <main className="flex-1 overflow-auto print-area pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
