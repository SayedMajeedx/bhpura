import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useStorefront } from "@/lib/storefront-context";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/store/$slug/page/$idx")({
  component: PageView,
  notFoundComponent: PageMissing,
});

function PageView() {
  const { idx } = Route.useParams();
  const n = Number(idx);
  const { settings, lang, brand, t } = useStorefront();
  if (!Number.isInteger(n) || n < 1 || n > settings.pages.length) throw notFound();

  const page = settings.pages[n - 1];
  const title = lang === "ar" ? (page.title_ar || page.title_en) : (page.title_en || page.title_ar);
  const content = lang === "ar" ? (page.content_ar || page.content_en) : (page.content_en || page.content_ar);

  if (!title && !content) return <PageMissing />;

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-14">
      <Link
        to="/store/$slug"
        params={{ slug: brand.slug }}
        className="inline-flex items-center gap-1 text-sm mb-4 hover:underline"
        style={{ color: "var(--sf-link)" }}
      >
        <ChevronLeft className="h-4 w-4" />
        {t("العودة إلى المتجر", "Back to store")}
      </Link>
      {title && (
        <h1 className="font-display text-3xl sm:text-4xl mb-6" style={{ color: "var(--sf-heading)" }}>
          {title}
        </h1>
      )}
      {page.image_url && (
        <img
          src={page.image_url}
          alt={title ?? ""}
          className="w-full rounded-lg mb-6 object-cover max-h-[520px]"
        />
      )}
      {content && (
        <div className="prose prose-neutral max-w-none whitespace-pre-wrap leading-relaxed text-base">
          {content}
        </div>
      )}
    </article>
  );
}

function PageMissing() {
  const { t } = useStorefront();
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">{t("الصفحة غير متوفرة", "This page is not available")}</p>
      </Card>
    </div>
  );
}
