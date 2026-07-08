import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStorefront, formatPrice } from "@/lib/storefront-context";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/store/$slug/")({
  component: StoreHome,
});

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  media: unknown;
  brand_id: string;
  product_variants: Array<{
    id: string;
    selling_price: number;
    stock_main: number;
    size: string | null;
    color: string | null;
  }>;
};

type CategoryRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  slug: string | null;
  image_url: string | null;
  sort_order: number;
};

function StoreHome() {
  const { brand } = useStorefront();
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["storefront", brand.slug, "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, description, category, image_url, media, brand_id, product_variants(id, selling_price, stock_main, size, color)",
        )
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProductRow[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const { data: categories } = useQuery({
    queryKey: ["storefront", brand.slug, "categories"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any)
        .select("id, name_en, name_ar, slug, image_url, sort_order")
        .eq("brand_id", brand.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = products ?? [];
    if (!activeCat) return list;
    const match = list.filter((p) => p.category === activeCat);
    // Fallback: if the selected category filters to zero (e.g. legacy category name mismatch),
    // show the full list rather than a misleading "no products" screen.
    return match.length > 0 ? match : list;
  }, [products, activeCat]);

  return (
    <div>
      <HeroBanner />
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <Categories
          products={products ?? []}
          categories={categories ?? []}
          activeCat={activeCat}
          onSelect={setActiveCat}
        />
        <ProductGrid products={filtered} loading={isLoading} />
      </section>
    </div>
  );
}

function HeroBanner() {
  const { brand, settings, t, lang } = useStorefront();
  const media = brand.hero_media && brand.hero_media.length > 0 ? brand.hero_media : null;

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ minHeight: "clamp(320px, 55vh, 640px)" }}
    >
      {media ? (
        <HeroCarousel items={media} />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${settings.primary_color}22, ${settings.primary_color}66)`,
          }}
        />
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 h-full flex items-center min-h-[320px] sm:min-h-[55vh]">
        <div className="max-w-xl bg-white/85 backdrop-blur rounded-2xl p-6 sm:p-8 shadow-lg">
          <h1
            className="font-display text-3xl sm:text-5xl mb-3"
            style={{ color: "var(--sf-heading)" }}
          >
            {lang === "ar" ? brand.name_ar || brand.name_en : brand.name_en}
          </h1>
          <p className="text-sm sm:text-base text-neutral-700 mb-4">
            {(lang === "ar" ? brand.about_ar : brand.about_en) ||
              t("مجموعة مختارة بعناية لك.", "A curated collection made for you.")}
          </p>
          <a
            href="#products"
            className="inline-flex items-center px-6 py-3 rounded-full font-semibold"
            style={{ backgroundColor: "var(--sf-btn-primary-bg)", color: "var(--sf-btn-primary-fg)" }}
          >
            {t("تسوّق الآن", "Shop now")}
          </a>
        </div>
      </div>
    </section>
  );
}

function HeroCarousel({ items }: { items: Array<{ type: "image" | "video"; url: string }> }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (items.length <= 1 || items[idx]?.type === "video") return;
    timer.current = window.setTimeout(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [idx, items]);

  return (
    <div className="absolute inset-0">
      {items.map((m, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0 }}
        >
          {m.type === "video" ? (
            <video
              src={m.url}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img src={m.url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
}

function Categories({
  products,
  categories,
  activeCat,
  onSelect,
}: {
  products: ProductRow[];
  categories: CategoryRow[];
  activeCat: string | null;
  onSelect: (c: string | null) => void;
}) {
  const { t, lang } = useStorefront();

  // Merge admin-defined categories with any legacy categories referenced by products
  const merged = useMemo(() => {
    const known = new Map<string, { key: string; label: string; image: string | null }>();
    for (const c of categories) {
      const key = c.slug || c.name_en;
      const label = (lang === "ar" ? c.name_ar : c.name_en) || c.name_en;
      known.set(key, { key, label, image: c.image_url });
    }
    for (const p of products) {
      if (p.category && !known.has(p.category)) {
        known.set(p.category, { key: p.category, label: p.category, image: null });
      }
    }
    return Array.from(known.values());
  }, [categories, products, lang]);

  if (merged.length === 0) return null;

  return (
    <div className="mb-8 flex flex-wrap gap-2 justify-center">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm border transition-colors ${
          activeCat === null ? "bg-neutral-900 text-white border-neutral-900" : "bg-white/80 text-neutral-800 border-neutral-200 hover:bg-neutral-100"
        }`}
      >
        {t("الكل", "All")}
      </button>
      {merged.map((c) => {
        const active = activeCat === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            className={`px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-2 transition-colors ${
              active ? "bg-neutral-900 text-white border-neutral-900" : "bg-white/80 text-neutral-800 border-neutral-200 hover:bg-neutral-100"
            }`}
          >
            {c.image && (
              <img src={c.image} alt="" className="h-5 w-5 rounded-full object-cover" />
            )}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function ProductGrid({ products, loading }: { products: ProductRow[]; loading: boolean }) {
  const { t } = useStorefront();
  if (loading) {
    return (
      <div id="products" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[3/4] rounded-xl w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <Card id="products" className="p-8 sm:p-12 text-center text-muted-foreground">
        {t("لا توجد منتجات بعد.", "No products yet.")}
      </Card>
    );
  }

  return (
    <div id="products" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: ProductRow }) {
  const { brand, currency, lang, t } = useStorefront();
  const prices = product.product_variants.map((v) => v.selling_price).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const totalStock = product.product_variants.reduce((s, v) => s + (v.stock_main || 0), 0);
  const oos = totalStock <= 0;

  const media = Array.isArray(product.media)
    ? (product.media as Array<{ type: string; url: string }>)
    : [];
  const cover = media.find((m) => m.type === "image")?.url || product.image_url;

  return (
    <Link
      to="/store/$slug/product/$id"
      params={{ slug: brand.slug, id: product.id }}
      className="group block"
    >
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted relative">
        {cover ? (
          <img
            src={cover}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">
            {t("لا توجد صورة", "No image")}
          </div>
        )}
        {oos && (
          <div className="absolute inset-0 bg-black/40 grid place-items-center">
            <span className="bg-white/95 px-3 py-1 rounded-full text-xs font-semibold text-neutral-900">
              {t("نفد المخزون", "Sold out")}
            </span>
          </div>
        )}
      </div>
      <div className="mt-2">
        <div className="text-sm font-medium truncate">{product.name}</div>
        <div className="text-sm font-semibold" style={{ color: "var(--sf-heading)" }}>
          {minPrice > 0 ? formatPrice(minPrice, currency, lang) : t("السعر عند الطلب", "Price on request")}
        </div>
      </div>
    </Link>
  );
}
