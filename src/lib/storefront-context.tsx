import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type StoreLang = "ar" | "en";

export type Brand = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  logo_url: string | null;
  hero_media: Array<{ type: "image" | "video"; url: string }>;
  primary_color: string | null;
  about_ar: string | null;
  about_en: string | null;
};

export type PublicSettings = {
  brand_id: string;
  business_name: string;
  logo_url: string | null;
  currency: string;
  primary_color: string;
  text_color: string;
  background_color: string;
  cod_enabled: boolean;
  card_enabled: boolean;
  benefit_enabled: boolean;
  benefit_qr_url: string | null;
  footer_note: string | null;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
};

export type CartItem = {
  variant_id: string;
  product_id: string;
  name: string;
  image: string | null;
  price: number;
  size: string | null;
  color: string | null;
  qty: number;
  max_stock: number;
};

type StoreCtx = {
  brand: Brand;
  settings: PublicSettings;
  lang: StoreLang;
  setLang: (l: StoreLang) => void;
  dir: "rtl" | "ltr";
  t: (ar: string, en: string) => string;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (variant_id: string) => void;
  updateQty: (variant_id: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  currency: string;
  session: Session | null;
  signOut: () => Promise<void>;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StorefrontProvider({
  brand,
  settings,
  children,
}: {
  brand: Brand;
  settings: PublicSettings;
  children: ReactNode;
}) {
  const cartKey = `storefront-cart:${brand.slug}`;
  const langKey = `storefront-lang:${brand.slug}`;

  const [lang, setLangState] = useState<StoreLang>("ar");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const l = localStorage.getItem(langKey);
      if (l === "en" || l === "ar") setLangState(l);
      const c = localStorage.getItem(cartKey);
      if (c) setCart(JSON.parse(c));
    } catch {}
  }, [cartKey, langKey]);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {}
  }, [cart, cartKey]);

  // Auth session — track for cross-brand shopper accounts
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const setLang = useCallback(
    (l: StoreLang) => {
      setLangState(l);
      try {
        localStorage.setItem(langKey, l);
      } catch {}
    },
    [langKey],
  );

  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
  }, [lang, dir]);

  const t = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.variant_id === item.variant_id);
      if (existing) {
        return prev.map((c) =>
          c.variant_id === item.variant_id
            ? { ...c, qty: Math.min(c.max_stock, c.qty + item.qty) }
            : c,
        );
      }
      return [...prev, { ...item, qty: Math.min(item.qty, item.max_stock) }];
    });
  }, []);

  const removeFromCart = useCallback((variant_id: string) => {
    setCart((prev) => prev.filter((c) => c.variant_id !== variant_id));
  }, []);

  const updateQty = useCallback((variant_id: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.variant_id === variant_id ? { ...c, qty: Math.min(c.max_stock, Math.max(1, qty)) } : c))
        .filter((c) => c.qty > 0),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.qty * c.price, 0), [cart]);

  const value: StoreCtx = {
    brand,
    settings,
    lang,
    setLang,
    dir,
    t,
    cart,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    cartCount,
    cartTotal,
    currency: settings.currency || "BHD",
    session,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStorefront() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStorefront must be used within StorefrontProvider");
  return v;
}

export function formatPrice(amount: number, currency: string, lang: StoreLang) {
  const n = new Intl.NumberFormat(lang === "ar" ? "ar-BH" : "en-BH", {
    style: "currency",
    currency,
    maximumFractionDigits: 3,
  });
  try {
    return n.format(amount);
  } catch {
    return `${amount.toFixed(3)} ${currency}`;
  }
}
