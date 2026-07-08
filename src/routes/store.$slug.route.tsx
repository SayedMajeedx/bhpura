import { createFileRoute, Outlet, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  StorefrontProvider,
  useStorefront,
  formatPrice,
  type Brand,
  type PublicSettings,
  readableOn,
} from "@/lib/storefront-context";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ShoppingBag, Languages, Minus, Plus, Trash2, X, User, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const { data: brand, error: brandErr } = await supabase
      .from("brands")
      .select("id, slug, name_en, name_ar, logo_url, is_active, hero_media, primary_color, about_ar, about_en")
      .eq("slug", params.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (brandErr || !brand) throw notFound();

    const { data: settings } = await supabase
      .from("brand_public_settings")
      .select("*")
      .eq("brand_id", brand.id)
      .maybeSingle();

    const s = settings as any;
    const rawPages = Array.isArray(s?.pages) ? s.pages : [];
    const normalizedPages = rawPages.map((p: any) => ({
      title_ar: p?.title_ar ?? null,
      title_en: p?.title_en ?? null,
      content_ar: p?.content_ar ?? null,
      content_en: p?.content_en ?? null,
      image_url: p?.image_url ?? null,
    }));
    const rawSocials = Array.isArray(s?.socials) ? s.socials : [];
    const normalizedSocials = rawSocials
      .map((x: any) => ({ name: String(x?.name ?? "").trim(), url: String(x?.url ?? "").trim() }))
      .filter((x: { name: string; url: string }) => x.name && x.url);
    const safeSettings: PublicSettings = {
      brand_id: brand.id,
      business_name: s?.business_name ?? brand.name_en,
      logo_url: s?.logo_url ?? brand.logo_url ?? null,
      currency: s?.currency ?? "BHD",
      primary_color: s?.primary_color ?? brand.primary_color ?? "#8b6f47",
      text_color: s?.text_color ?? "#111111",
      background_color: s?.background_color ?? "#ffffff",
      cod_enabled: s?.cod_enabled ?? true,
      card_enabled: s?.card_enabled ?? false,
      benefit_enabled: s?.benefit_enabled ?? false,
      benefit_qr_url: s?.benefit_qr_url ?? null,
      footer_note: s?.footer_note ?? null,
      delivery_enabled: s?.delivery_enabled ?? true,
      pickup_enabled: s?.pickup_enabled ?? true,
      delivery_fee: Number(s?.delivery_fee ?? 0),
      logo_size: Number(s?.logo_size ?? 48),
      logo_align: (s?.logo_align ?? "left") as "left" | "center" | "right",
      header_bg: s?.header_bg ?? null,
      header_fg: s?.header_fg ?? null,
      footer_bg: s?.footer_bg ?? null,
      footer_fg: s?.footer_fg ?? null,
      heading_color: s?.heading_color ?? null,
      link_color: s?.link_color ?? null,
      btn_primary_bg: s?.btn_primary_bg ?? null,
      btn_primary_fg: s?.btn_primary_fg ?? null,
      btn_secondary_bg: s?.btn_secondary_bg ?? null,
      btn_secondary_fg: s?.btn_secondary_fg ?? null,
      btn_checkout_bg: s?.btn_checkout_bg ?? null,
      btn_checkout_fg: s?.btn_checkout_fg ?? null,
      pages: normalizedPages,
      whatsapp_enabled: Boolean(s?.whatsapp_enabled),
      whatsapp_number: s?.whatsapp_number ?? null,
    };


    const heroArr = Array.isArray(brand.hero_media)
      ? (brand.hero_media as unknown as Array<{ type: "image" | "video"; url: string }>)
      : [];
    return {
      brand: { ...brand, hero_media: heroArr } as unknown as Brand,
      settings: safeSettings,
    };
  },
  head: ({ loaderData }) => {
    const b = loaderData?.brand;
    if (!b) return { meta: [{ title: "Storefront" }] };
    const title = `${b.name_en} — Storefront`;
    const desc = `Shop ${b.name_en}${b.name_ar ? " / " + b.name_ar : ""} online.`;
    const img = b.logo_url ?? undefined;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        ...(img ? [{ property: "og:image", content: img }] : []),
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
      ],
    };
  },
  component: StorefrontLayout,
  errorComponent: StorefrontError,
  notFoundComponent: StorefrontError,
});

function StorefrontLayout() {
  const { brand, settings } = Route.useLoaderData();
  return (
    <StorefrontProvider brand={brand} settings={settings}>
      <StoreShell />
    </StorefrontProvider>
  );
}

function StoreShell() {
  const { brand, settings } = useStorefront();
  const qc = useQueryClient();

  // Realtime: refresh product / variant queries when inventory changes for this brand
  useEffect(() => {
    const channel = supabase
      .channel(`storefront:${brand.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `brand_id=eq.${brand.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["storefront", brand.slug] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_variants", filter: `brand_id=eq.${brand.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["storefront", brand.slug] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [brand.id, brand.slug, qc]);

  const primary = settings.primary_color;
  const headerBg = settings.header_bg ?? settings.background_color ?? "#ffffff";
  const headerFg = settings.header_fg ?? readableOn(headerBg, settings.text_color);
  const footerBg = settings.footer_bg ?? settings.background_color ?? "#ffffff";
  const footerFg = settings.footer_fg ?? readableOn(footerBg, settings.text_color);
  const btnPrimaryBg = settings.btn_primary_bg ?? primary;
  const btnPrimaryFg = settings.btn_primary_fg ?? readableOn(btnPrimaryBg, "#ffffff");
  const btnSecondaryBg = settings.btn_secondary_bg ?? "#111111";
  const btnSecondaryFg = settings.btn_secondary_fg ?? readableOn(btnSecondaryBg, "#ffffff");
  const headingColor = settings.heading_color ?? primary;
  const linkColor = settings.link_color ?? primary;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={
        {
          backgroundColor: settings.background_color,
          color: settings.text_color,
          ["--brand" as any]: primary,
          ["--sf-header-bg" as any]: headerBg,
          ["--sf-header-fg" as any]: headerFg,
          ["--sf-footer-bg" as any]: footerBg,
          ["--sf-footer-fg" as any]: footerFg,
          ["--sf-btn-primary-bg" as any]: btnPrimaryBg,
          ["--sf-btn-primary-fg" as any]: btnPrimaryFg,
          ["--sf-btn-secondary-bg" as any]: btnSecondaryBg,
          ["--sf-btn-secondary-fg" as any]: btnSecondaryFg,
          ["--sf-heading" as any]: headingColor,
          ["--sf-link" as any]: linkColor,
        } as React.CSSProperties
      }
    >
      <StoreHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter />
      <WhatsAppFab />
    </div>
  );
}

function WhatsAppFab() {
  const { settings, lang, brand } = useStorefront();
  if (!settings.whatsapp_enabled) return null;
  const digits = (settings.whatsapp_number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const text = lang === "ar"
    ? `مرحباً! لدي استفسار عن متجر ${brand.name_ar || brand.name_en}`
    : `Hi! I have a question about ${brand.name_en}`;
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className={`fixed z-50 bottom-5 ${lang === "ar" ? "left-5" : "right-5"} h-14 w-14 rounded-full grid place-items-center shadow-lg hover:scale-105 transition-transform`}
      style={{ backgroundColor: "#25D366", color: "#fff" }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
        <path d="M20.52 3.48A11.94 11.94 0 0 0 12.06 0C5.5 0 .2 5.3.2 11.86c0 2.09.55 4.13 1.6 5.93L0 24l6.38-1.67a11.86 11.86 0 0 0 5.68 1.45h.01c6.56 0 11.86-5.3 11.86-11.86 0-3.17-1.23-6.15-3.41-8.44ZM12.07 21.5h-.01a9.63 9.63 0 0 1-4.9-1.34l-.35-.21-3.79.99 1.01-3.7-.23-.38a9.63 9.63 0 0 1-1.48-5.15c0-5.32 4.33-9.65 9.66-9.65 2.58 0 5 1 6.83 2.83a9.6 9.6 0 0 1 2.82 6.82c0 5.32-4.33 9.65-9.66 9.65Zm5.29-7.23c-.29-.15-1.71-.85-1.98-.94-.27-.1-.46-.15-.66.14-.19.29-.75.94-.92 1.13-.17.19-.34.22-.63.07-.29-.14-1.23-.45-2.35-1.44-.87-.77-1.46-1.72-1.63-2.01-.17-.29-.02-.44.13-.59.13-.13.29-.34.44-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.14-.66-1.58-.9-2.17-.24-.58-.48-.5-.66-.51h-.56c-.19 0-.51.07-.77.36-.27.29-1.02 1-1.02 2.44 0 1.44 1.05 2.83 1.2 3.02.14.19 2.07 3.15 5.02 4.42.7.3 1.24.48 1.66.62.7.22 1.33.19 1.83.11.56-.08 1.71-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34Z"/>
      </svg>
    </a>
  );
}

function StoreHeader() {
  const { brand, settings, lang, setLang, t, cartCount, session, signOut } = useStorefront();
  const displayName = lang === "ar" ? brand.name_ar || brand.name_en : brand.name_en;
  const align = settings.logo_align ?? "left";
  const logoSize = settings.logo_size || 40;

  return (
    <header
      className="sticky top-0 z-40 w-full border-b backdrop-blur"
      style={{
        backgroundColor: "var(--sf-header-bg)",
        color: "var(--sf-header-fg)",
        borderColor: "rgba(0,0,0,0.08)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex flex-col gap-2">
        <div className="h-14 flex items-center gap-3 justify-between">
          <Link
            to="/store/$slug"
            params={{ slug: brand.slug }}
            className={`flex items-center gap-3 min-w-0 ${align === "center" ? "sm:mx-auto" : ""}`}
            style={{ color: "var(--sf-header-fg)" }}
          >
            {settings.logo_url && (
              <img
                src={settings.logo_url}
                alt={displayName}
                className="shrink-0 object-contain"
                style={{
                  height: logoSize,
                  maxHeight: logoSize,
                  width: "auto",
                  maxWidth: logoSize * 3,
                }}
              />
            )}
            <span
              className="font-display text-lg sm:text-xl truncate"
              style={{ color: "var(--sf-heading)" }}
            >
              {displayName}
            </span>
          </Link>

          {/* Desktop search */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <SearchBar />
          </div>

          <div
            className="flex items-center gap-1 sm:gap-2 shrink-0"
            style={{ color: "var(--sf-header-fg)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 hover:bg-black/5"
              style={{ color: "var(--sf-header-fg)" }}
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              aria-label="Language switch"
            >
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">{lang === "ar" ? "English" : "العربية"}</span>
            </Button>

            {session ? (
              <Button variant="ghost" size="sm" className="gap-1 hover:bg-black/5" style={{ color: "var(--sf-header-fg)" }} onClick={() => signOut()} title={session.user?.email ?? ""}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline max-w-[120px] truncate">{session.user?.email ?? t("خروج", "Sign out")}</span>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="gap-1 hover:bg-black/5" style={{ color: "var(--sf-header-fg)" }}>
                <Link to="/store/$slug/auth" params={{ slug: brand.slug }}>
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("دخول", "Sign in")}</span>
                </Link>
              </Button>
            )}

            <CartDrawer>
              <Button variant="ghost" size="sm" className="relative gap-1 hover:bg-black/5" style={{ color: "var(--sf-header-fg)" }}>
                <ShoppingBag className="h-5 w-5" />
                <span className="hidden sm:inline">{t("السلة", "Cart")}</span>
                {cartCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold grid place-items-center"
                    style={{ backgroundColor: "var(--sf-btn-primary-bg)", color: "var(--sf-btn-primary-fg)" }}
                  >
                    {cartCount}
                  </span>
                )}
              </Button>
            </CartDrawer>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden pb-1">
          <SearchBar />
        </div>
      </div>
    </header>
  );
}


function CartDrawer({ children }: { children: React.ReactNode }) {
  const { cart, cartTotal, currency, lang, t, updateQty, removeFromCart, brand, settings } =
    useStorefront();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{t("سلة التسوق", "Your cart")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto py-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              {t("السلة فارغة", "Your cart is empty")}
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.variant_id} className="flex gap-3 border rounded-lg p-2 items-center">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-16 w-16 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[item.size, item.color].filter(Boolean).join(" · ")}
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: settings.primary_color }}>
                    {formatPrice(item.price * item.qty, currency, lang)}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex items-center border rounded">
                    <button
                      className="px-2 py-1"
                      onClick={() => updateQty(item.variant_id, item.qty - 1)}
                      aria-label="decrease"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-2 text-sm min-w-[24px] text-center">{item.qty}</span>
                    <button
                      className="px-2 py-1 disabled:opacity-40"
                      disabled={item.qty >= item.max_stock}
                      onClick={() => updateQty(item.variant_id, item.qty + 1)}
                      aria-label="increase"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    className="text-xs text-red-600 flex items-center gap-1"
                    onClick={() => removeFromCart(item.variant_id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("حذف", "Remove")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between text-lg font-semibold">
              <span>{t("الإجمالي", "Total")}</span>
              <span style={{ color: settings.primary_color }}>{formatPrice(cartTotal, currency, lang)}</span>
            </div>
            <Button
              className="w-full h-12"
              style={{ backgroundColor: "var(--sf-btn-primary-bg)", color: "var(--sf-btn-primary-fg)" }}
              onClick={() => {
                setOpen(false);
                navigate({ to: "/store/$slug/checkout", params: { slug: brand.slug } });
              }}
            >
              {t("إتمام الشراء", "Checkout")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SearchBar() {
  const { brand, lang, t } = useStorefront();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;
        navigate({ to: "/store/$slug/search", params: { slug: brand.slug }, search: { q: query } });
      }}
      className="relative w-full"
    >
      <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 opacity-60 ${lang === "ar" ? "right-3" : "left-3"}`} />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("ابحث عن منتج...", "Search for products...")}
        className={`h-10 bg-white/70 dark:bg-black/20 border-black/10 ${lang === "ar" ? "pr-9" : "pl-9"}`}
        inputMode="search"
        enterKeyHint="search"
        aria-label={t("ابحث عن منتج", "Search products")}
      />
    </form>
  );
}

function StoreFooter() {
  const { settings, t, brand, lang } = useStorefront();
  const pageLinks = settings.pages
    .map((p, i) => ({
      idx: i + 1,
      title: lang === "ar" ? (p.title_ar || p.title_en) : (p.title_en || p.title_ar),
      hasContent: Boolean(p.title_ar || p.title_en),
    }))
    .filter((p) => p.hasContent && p.title);
  return (
    <footer
      className="border-t mt-16 py-8"
      style={{
        borderColor: "rgba(0,0,0,0.08)",
        backgroundColor: "var(--sf-footer-bg)",
        color: "var(--sf-footer-fg)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center text-sm space-y-3" style={{ color: "var(--sf-footer-fg)" }}>
        <div className="font-medium" style={{ color: "var(--sf-heading)" }}>
          {lang === "ar" ? brand.name_ar || brand.name_en : brand.name_en}
        </div>
        {pageLinks.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {pageLinks.map((p) => (
              <Link
                key={p.idx}
                to="/store/$slug/page/$idx"
                params={{ slug: brand.slug, idx: String(p.idx) }}
                className="underline-offset-2 hover:underline"
                style={{ color: "var(--sf-link)" }}
              >
                {p.title}
              </Link>
            ))}
          </nav>
        )}
        {settings.footer_note && <div>{settings.footer_note}</div>}
        <div>© {new Date().getFullYear()} — {t("جميع الحقوق محفوظة", "All rights reserved")}</div>
      </div>
    </footer>
  );
}

function StorefrontError() {
  return (
    <div className="min-h-screen grid place-items-center p-8">
      <Card className="p-8 text-center max-w-md">
        <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-muted grid place-items-center">
          <X className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-display mb-2">Storefront unavailable</h1>
        <p className="text-muted-foreground">This brand doesn't have an active storefront yet.</p>
      </Card>
    </div>
  );
}
