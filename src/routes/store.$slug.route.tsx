import { createFileRoute, Outlet, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  StorefrontProvider,
  useStorefront,
  formatPrice,
  type Brand,
  type PublicSettings,
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
import { ShoppingBag, Languages, Minus, Plus, Trash2, X, User, LogOut } from "lucide-react";

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

    const safeSettings: PublicSettings = {
      brand_id: brand.id,
      business_name: settings?.business_name ?? brand.name_en,
      logo_url: settings?.logo_url ?? brand.logo_url ?? null,
      currency: settings?.currency ?? "BHD",
      primary_color: settings?.primary_color ?? brand.primary_color ?? "#8b6f47",
      text_color: settings?.text_color ?? "#111111",
      background_color: settings?.background_color ?? "#ffffff",
      cod_enabled: settings?.cod_enabled ?? true,
      card_enabled: settings?.card_enabled ?? false,
      benefit_enabled: settings?.benefit_enabled ?? false,
      benefit_qr_url: settings?.benefit_qr_url ?? null,
      footer_note: settings?.footer_note ?? null,
      delivery_enabled: (settings as any)?.delivery_enabled ?? true,
      pickup_enabled: (settings as any)?.pickup_enabled ?? true,
      delivery_fee: Number((settings as any)?.delivery_fee ?? 0),
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={
        {
          backgroundColor: settings.background_color,
          color: settings.text_color,
          ["--brand" as any]: primary,
        } as React.CSSProperties
      }
    >
      <StoreHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  );
}

function StoreHeader() {
  const { brand, settings, lang, setLang, t, cartCount, session, signOut } = useStorefront();
  const displayName = lang === "ar" ? brand.name_ar || brand.name_en : brand.name_en;

  return (
    <header
      className="sticky top-0 z-40 w-full border-b backdrop-blur bg-white/80"
      style={{ borderColor: "rgba(0,0,0,0.06)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link
          to="/store/$slug"
          params={{ slug: brand.slug }}
          className="flex items-center gap-3 min-w-0"
        >
          {settings.logo_url && (
            <img
              src={settings.logo_url}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
          )}
          <span className="font-display text-lg sm:text-xl truncate" style={{ color: settings.primary_color }}>
            {displayName}
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            aria-label="Language switch"
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">{lang === "ar" ? "English" : "العربية"}</span>
          </Button>

          {session ? (
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => signOut()} title={session.user?.email ?? ""}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline max-w-[120px] truncate">{session.user?.email ?? t("خروج", "Sign out")}</span>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/store/$slug/auth" params={{ slug: brand.slug }}>
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{t("دخول", "Sign in")}</span>
              </Link>
            </Button>
          )}

          <CartDrawer>
            <Button variant="ghost" size="sm" className="relative gap-1">
              <ShoppingBag className="h-5 w-5" />
              <span className="hidden sm:inline">{t("السلة", "Cart")}</span>
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold grid place-items-center text-white"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  {cartCount}
                </span>
              )}
            </Button>
          </CartDrawer>
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
              style={{ backgroundColor: settings.primary_color, color: "#fff" }}
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

function StoreFooter() {
  const { settings, t, brand, lang } = useStorefront();
  return (
    <footer className="border-t mt-16 py-8" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center text-sm text-muted-foreground space-y-1">
        <div className="font-medium" style={{ color: settings.primary_color }}>
          {lang === "ar" ? brand.name_ar || brand.name_en : brand.name_en}
        </div>
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
