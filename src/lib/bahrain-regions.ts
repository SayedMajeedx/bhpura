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
  road?: string | null;
  house?: string | null;
  flat?: string | null;
  is_default?: boolean;
};

export function formatAddressLine(a: StructuredAddress | null | undefined, lang: "en" | "ar"): string {
  if (!a) return "";
  const region = regionLabel(a.region, lang);
  const road = a.road?.trim() || "";
  const house = a.house?.trim() || "";
  const flat = a.flat?.trim() || "";
  const parts = lang === "ar" ? [region, road, house, flat] : [flat, house, road, region];
  const sep = lang === "ar" ? "، " : ", ";
  return parts.filter((p) => p && p.length > 0).join(sep);
}