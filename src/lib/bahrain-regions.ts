export const BAHRAIN_REGIONS: { value: string; en: string; ar: string }[] = [
  { value: "manama", en: "Manama", ar: "المنامة" },
  { value: "muharraq", en: "Muharraq", ar: "المحرق" },
  { value: "riffa", en: "Riffa", ar: "الرفاع" },
  { value: "hamad_town", en: "Hamad Town", ar: "مدينة حمد" },
  { value: "isa_town", en: "Isa Town", ar: "مدينة عيسى" },
  { value: "hidd", en: "Hidd", ar: "الحد" },
  { value: "budaiya", en: "Budaiya", ar: "البديع" },
  { value: "sanabis", en: "Sanabis", ar: "السنابس" },
  { value: "juffair", en: "Juffair", ar: "الجفير" },
  { value: "seef", en: "Seef", ar: "السيف" },
  { value: "saar", en: "Saar", ar: "سار" },
  { value: "sitra", en: "Sitra", ar: "سترة" },
  { value: "amwaj", en: "Amwaj Islands", ar: "جزر أمواج" },
  { value: "adliya", en: "Adliya", ar: "العدلية" },
  { value: "gudaibiya", en: "Gudaibiya", ar: "القضيبية" },
  { value: "salmaniya", en: "Salmaniya", ar: "السلمانية" },
  { value: "tubli", en: "Tubli", ar: "توبلي" },
  { value: "jidhafs", en: "Jidhafs", ar: "جدحفص" },
  { value: "aali", en: "A'ali", ar: "عالي" },
  { value: "zallaq", en: "Zallaq", ar: "الزلاق" },
  { value: "durrat", en: "Durrat Al Bahrain", ar: "درة البحرين" },
  { value: "askar", en: "Askar", ar: "عسكر" },
  { value: "jasra", en: "Jasra", ar: "الجسرة" },
  { value: "diyar", en: "Diyar Al Muharraq", ar: "ديار المحرق" },
  { value: "busaiteen", en: "Busaiteen", ar: "البسيتين" },
  { value: "galali", en: "Galali", ar: "قلالي" },
  { value: "arad", en: "Arad", ar: "عراد" },
  { value: "malikiya", en: "Malikiya", ar: "المالكية" },
  { value: "karzakan", en: "Karzakan", ar: "كرزكان" },
  { value: "duraz", en: "Duraz", ar: "الدراز" },
  { value: "bani_jamra", en: "Bani Jamra", ar: "بني جمرة" },
  { value: "north_city", en: "Northern City", ar: "مدينة سلمان" },
];

export function regionLabel(value: string | null | undefined, lang: "en" | "ar") {
  if (!value) return "";
  const found = BAHRAIN_REGIONS.find((r) => r.value === value);
  if (found) return lang === "ar" ? found.ar : found.en;
  return value;
}

export type StructuredAddress = {
  id?: string;
  label?: string | null;
  region?: string | null;
  block?: string | null;
  road?: string | null;
  house?: string | null;
  flat?: string | null;
  is_default?: boolean;
};

/**
 * Translate common Arabic address terms into English equivalents so that
 * free-text address fields render correctly on the English invoice even
 * when the user typed them in Arabic.
 */
const AR_ADDRESS_TERMS: Array<[RegExp, string]> = [
  [/مجمع/g, "Block"],
  [/مجمّع/g, "Block"],
  [/مجموعة/g, "Block"],
  [/طريق/g, "Road"],
  [/شارع/g, "Street"],
  [/منزل/g, "House"],
  [/بيت/g, "House"],
  [/شقة/g, "Flat"],
  [/مبنى/g, "Building"],
  [/مبني/g, "Building"],
];

export function translateArabicAddressTerms(s: string | null | undefined, lang: "en" | "ar"): string {
  if (!s) return "";
  if (lang !== "en") return s;
  let out = s;
  for (const [re, en] of AR_ADDRESS_TERMS) out = out.replace(re, en);
  return out;
}

/** Compact one-line address for pickers and lists. */
export function formatAddressLine(a: StructuredAddress | null | undefined, lang: "en" | "ar"): string {
  if (!a) return "";
  const region = regionLabel(a.region, lang);
  const block = translateArabicAddressTerms(a.block?.trim() || "", lang);
  const road = translateArabicAddressTerms(a.road?.trim() || "", lang);
  const house = translateArabicAddressTerms(a.house?.trim() || "", lang);
  const flat = translateArabicAddressTerms(a.flat?.trim() || "", lang);
  const parts = lang === "ar"
    ? [region, block, road, house, flat]
    : [flat, house, road, block, region];
  const sep = lang === "ar" ? "، " : ", ";
  return parts.filter((p) => p && p.length > 0).join(sep);
}

/**
 * Labeled multi-part address for invoices, order details, and thank-you pages.
 * EN: "Block: 428, Road: 2825, House: 12, Flat: 4, Manama"
 * AR: "المنطقة: المنامة، المجمع: 428، طريق: 2825، منزل: 12، شقة: 4"
 * Flat is optional; empty fields are skipped.
 */
export function formatAddressDetailed(a: StructuredAddress | null | undefined, lang: "en" | "ar"): string {
  if (!a) return "";
  const region = regionLabel(a.region, lang);
  const block = translateArabicAddressTerms(a.block?.trim() || "", lang);
  const road = translateArabicAddressTerms(a.road?.trim() || "", lang);
  const house = translateArabicAddressTerms(a.house?.trim() || "", lang);
  const flat = translateArabicAddressTerms(a.flat?.trim() || "", lang);
  const parts: string[] = [];
  if (lang === "ar") {
    if (region) parts.push(`المنطقة: ${region}`);
    if (block) parts.push(`المجمع: ${block}`);
    if (road) parts.push(`طريق: ${road}`);
    if (house) parts.push(`منزل: ${house}`);
    if (flat) parts.push(`شقة: ${flat}`);
    return parts.join("، ");
  }
  if (block) parts.push(`Block: ${block}`);
  if (road) parts.push(`Road: ${road}`);
  if (house) parts.push(`House: ${house}`);
  if (flat) parts.push(`Flat: ${flat}`);
  if (region) parts.push(region);
  return parts.join(", ");
}
