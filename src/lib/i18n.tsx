import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

type Dict = Record<string, string>;

const en: Dict = {
  "app.title": "Pura",
  "app.subtitle": "Boutique management",
  "app.portalSubtitle": "Boutique management portal",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.print": "Print / PDF",
  "common.back": "Back",
  "common.new": "New",
  "common.pleaseWait": "Please wait...",
  "common.loading": "Loading…",
  "common.language": "Language",
  "common.confirmDelete": "Are you sure?",

  "nav.dashboard": "Dashboard",
  "nav.inventory": "Inventory",
  "nav.customers": "Customers",
  "nav.orders": "Orders & Invoices",
  "nav.settings": "Invoice Settings",
  "nav.signOut": "Sign out",

  "auth.welcomeBack": "Welcome back",
  "auth.createPortal": "Create your portal",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.newHere": "New here?",
  "auth.createAccount": "Create an account",
  "auth.haveAccount": "Already have an account?",
  "auth.backHome": "← Back home",
  "auth.accountCreated": "Account created",
  "auth.failed": "Authentication failed",

  "dashboard.title": "Dashboard",
  "dashboard.subtitle": "A quiet overview of your atelier.",
  "dashboard.revenue": "Revenue",
  "dashboard.orders": "Orders",
  "dashboard.customers": "Customers",
  "dashboard.unitsInStock": "Units in stock",
  "dashboard.recentOrders": "Recent orders",
  "dashboard.noOrders": "No orders yet. Create one from the Orders page.",

  "customers.title": "Customers",
  "customers.subtitle": "Your clientele, kept close.",
  "customers.new": "New customer",
  "customers.editTitle": "Edit customer",
  "customers.newTitle": "New customer",
  "customers.none": "No customers yet.",
  "customers.name": "Name",
  "customers.contact": "Contact",
  "customers.city": "City",
  "customers.phone": "Phone",
  "customers.email": "Email",
  "customers.address": "Address",
  "customers.notes": "Notes",
  "customers.deleteConfirm": "Delete this customer?",

  "inventory.title": "Inventory",
  "inventory.subtitle": "Products, variants, and customization add-ons.",
  "inventory.products": "Products",
  "inventory.customizations": "Customization add-ons",
  "inventory.newProduct": "New product",
  "inventory.editProduct": "Edit product",
  "inventory.none": "No products yet. Add your first abaya to get started.",
  "inventory.name": "Name",
  "inventory.category": "Category",
  "inventory.categoryPh": "e.g. Everyday, Occasion",
  "inventory.imageUrl": "Image URL",
  "inventory.description": "Description",
  "inventory.addVariant": "Add variant",
  "inventory.addonsIntro": "Reusable add-ons like embroidery, custom sizing, fabric upgrades. Pick them per order line.",
  "inventory.addonName": "Add-on name (e.g. Hand embroidery)",
  "inventory.addonPrice": "Price",
  "inventory.noAddons": "No add-ons yet.",

  "orders.title": "Orders & Invoices",
  "orders.subtitle": "Every sale, every invoice.",
  "orders.new": "New order",
  "orders.none": "No orders yet.",
  "orders.invoice": "Invoice",
  "orders.date": "Date",
  "orders.customer": "Customer",
  "orders.status": "Status",
  "orders.total": "Total",
  "orders.noCustomer": "No customer",
  "orders.deleteConfirm": "Delete this order?",

  "orderDetail.back": "Back to orders",
  "orderDetail.sendInvoice": "Send invoice",
  "orderDetail.lineItems": "Line items",
  "orderDetail.addLine": "Add line",
  "orderDetail.noLines": "No lines. Add products from your inventory.",
  "orderDetail.fromInventory": "From inventory",
  "orderDetail.pickVariant": "Pick a variant...",
  "orderDetail.customLine": "— Custom line —",
  "orderDetail.description": "Description",
  "orderDetail.qty": "Qty",
  "orderDetail.unitPrice": "Unit price",
  "orderDetail.customizations": "Customizations",
  "orderDetail.lineTotal": "Line total",
  "orderDetail.notes": "Notes",
  "orderDetail.discount": "Discount",
  "orderDetail.shipping": "Shipping",
  "orderDetail.taxRate": "Tax rate (%)",
  "orderDetail.subtotal": "Subtotal",
  "orderDetail.total": "Total",
  "orderDetail.orderDate": "Order date",

  "settings.title": "Invoice settings",
  "settings.subtitle": "Customize how your invoices look and print.",
  "settings.business": "Business details",
  "settings.appearance": "Invoice appearance",
  "settings.businessName": "Business name",
  "settings.logo": "Logo",
  "settings.address": "Address",
  "settings.phone": "Phone",
  "settings.email": "Email",
  "settings.vat": "VAT / Tax ID",
  "settings.currency": "Currency",
  "settings.defaultVat": "Default VAT %",
  "settings.footer": "Footer note",
  "settings.footerPh": "Thank you for your order…",
  "settings.fontFamily": "Font family",
  "settings.uploadFont": "Upload custom font (.woff2 / .woff / .ttf / .otf)",
  "settings.noFile": "No file uploaded",
  "settings.uploaded": "Custom font uploaded",
  "settings.fontSize": "Font size (px)",
  "settings.logoHeight": "Logo height (px)",
  "settings.accent": "Accent color",
  "settings.textColor": "Text color",
  "settings.bgColor": "Background color",
  "settings.previewText": "This is a preview of how invoice text will appear with your chosen styles.",
  "settings.save": "Save settings",
  "settings.saved": "Saved",

  "status.draft": "Draft",
  "status.confirmed": "Confirmed",
  "status.paid": "Paid",
  "status.shipped": "Shipped",
  "status.completed": "Completed",
  "status.cancelled": "Cancelled",
};

const ar: Dict = {
  "app.title": "بيورا",
  "app.subtitle": "إدارة البوتيك",
  "app.portalSubtitle": "بوابة إدارة البوتيك",

  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.delete": "حذف",
  "common.edit": "تعديل",
  "common.print": "طباعة / PDF",
  "common.back": "رجوع",
  "common.new": "جديد",
  "common.pleaseWait": "يرجى الانتظار...",
  "common.loading": "جارٍ التحميل…",
  "common.language": "اللغة",
  "common.confirmDelete": "هل أنت متأكد؟",

  "nav.dashboard": "لوحة التحكم",
  "nav.inventory": "المخزون",
  "nav.customers": "العملاء",
  "nav.orders": "الطلبات والفواتير",
  "nav.settings": "إعدادات الفاتورة",
  "nav.signOut": "تسجيل الخروج",

  "auth.welcomeBack": "مرحباً بعودتك",
  "auth.createPortal": "أنشئ بوابتك",
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.signIn": "تسجيل الدخول",
  "auth.signUp": "إنشاء حساب",
  "auth.newHere": "جديد هنا؟",
  "auth.createAccount": "إنشاء حساب جديد",
  "auth.haveAccount": "لديك حساب بالفعل؟",
  "auth.backHome": "← العودة للرئيسية",
  "auth.accountCreated": "تم إنشاء الحساب",
  "auth.failed": "فشل تسجيل الدخول",

  "dashboard.title": "لوحة التحكم",
  "dashboard.subtitle": "نظرة هادئة على أتيليهك.",
  "dashboard.revenue": "الإيرادات",
  "dashboard.orders": "الطلبات",
  "dashboard.customers": "العملاء",
  "dashboard.unitsInStock": "قطع في المخزون",
  "dashboard.recentOrders": "أحدث الطلبات",
  "dashboard.noOrders": "لا توجد طلبات بعد. أنشئ طلباً من صفحة الطلبات.",

  "customers.title": "العملاء",
  "customers.subtitle": "عميلاتك المميّزات دائماً بالقرب.",
  "customers.new": "عميلة جديدة",
  "customers.editTitle": "تعديل العميلة",
  "customers.newTitle": "عميلة جديدة",
  "customers.none": "لا يوجد عملاء بعد.",
  "customers.name": "الاسم",
  "customers.contact": "التواصل",
  "customers.city": "المدينة",
  "customers.phone": "الهاتف",
  "customers.email": "البريد الإلكتروني",
  "customers.address": "العنوان",
  "customers.notes": "ملاحظات",
  "customers.deleteConfirm": "حذف هذه العميلة؟",

  "inventory.title": "المخزون",
  "inventory.subtitle": "المنتجات والمتغيّرات وإضافات التخصيص.",
  "inventory.products": "المنتجات",
  "inventory.customizations": "إضافات التخصيص",
  "inventory.newProduct": "منتج جديد",
  "inventory.editProduct": "تعديل المنتج",
  "inventory.none": "لا توجد منتجات بعد. أضيفي أول عباءة للبدء.",
  "inventory.name": "الاسم",
  "inventory.category": "الفئة",
  "inventory.categoryPh": "مثال: يومي، مناسبات",
  "inventory.imageUrl": "رابط الصورة",
  "inventory.description": "الوصف",
  "inventory.addVariant": "إضافة متغيّر",
  "inventory.addonsIntro": "إضافات قابلة لإعادة الاستخدام مثل التطريز والقياس المخصّص وترقية الأقمشة. اختاريها لكل بند طلب.",
  "inventory.addonName": "اسم الإضافة (مثل: تطريز يدوي)",
  "inventory.addonPrice": "السعر",
  "inventory.noAddons": "لا توجد إضافات بعد.",

  "orders.title": "الطلبات والفواتير",
  "orders.subtitle": "كل عملية بيع، كل فاتورة.",
  "orders.new": "طلب جديد",
  "orders.none": "لا توجد طلبات بعد.",
  "orders.invoice": "الفاتورة",
  "orders.date": "التاريخ",
  "orders.customer": "العميلة",
  "orders.status": "الحالة",
  "orders.total": "الإجمالي",
  "orders.noCustomer": "بدون عميلة",
  "orders.deleteConfirm": "حذف هذا الطلب؟",

  "orderDetail.back": "العودة للطلبات",
  "orderDetail.sendInvoice": "إرسال الفاتورة",
  "orderDetail.lineItems": "بنود الطلب",
  "orderDetail.addLine": "إضافة بند",
  "orderDetail.noLines": "لا توجد بنود. أضيفي منتجات من مخزونك.",
  "orderDetail.fromInventory": "من المخزون",
  "orderDetail.pickVariant": "اختاري متغيّراً...",
  "orderDetail.customLine": "— بند مخصص —",
  "orderDetail.description": "الوصف",
  "orderDetail.qty": "الكمية",
  "orderDetail.unitPrice": "سعر الوحدة",
  "orderDetail.customizations": "التخصيصات",
  "orderDetail.lineTotal": "إجمالي البند",
  "orderDetail.notes": "ملاحظات",
  "orderDetail.discount": "الخصم",
  "orderDetail.shipping": "الشحن",
  "orderDetail.taxRate": "نسبة الضريبة (%)",
  "orderDetail.subtotal": "المجموع الفرعي",
  "orderDetail.total": "الإجمالي",
  "orderDetail.orderDate": "تاريخ الطلب",

  "settings.title": "إعدادات الفاتورة",
  "settings.subtitle": "خصّصي شكل وطباعة فواتيرك.",
  "settings.business": "بيانات النشاط",
  "settings.appearance": "مظهر الفاتورة",
  "settings.businessName": "اسم النشاط",
  "settings.logo": "الشعار",
  "settings.address": "العنوان",
  "settings.phone": "الهاتف",
  "settings.email": "البريد الإلكتروني",
  "settings.vat": "الرقم الضريبي",
  "settings.currency": "العملة",
  "settings.defaultVat": "نسبة الضريبة الافتراضية %",
  "settings.footer": "ملاحظة أسفل الفاتورة",
  "settings.footerPh": "شكراً لطلبك…",
  "settings.fontFamily": "نوع الخط",
  "settings.uploadFont": "رفع خط مخصص (.woff2 / .woff / .ttf / .otf)",
  "settings.noFile": "لم يتم رفع ملف",
  "settings.uploaded": "تم رفع الخط المخصص",
  "settings.fontSize": "حجم الخط (بكسل)",
  "settings.logoHeight": "ارتفاع الشعار (بكسل)",
  "settings.accent": "لون التمييز",
  "settings.textColor": "لون النص",
  "settings.bgColor": "لون الخلفية",
  "settings.previewText": "هذه معاينة لكيفية ظهور نص الفاتورة بالنمط الذي اخترتِه.",
  "settings.save": "حفظ الإعدادات",
  "settings.saved": "تم الحفظ",

  "status.draft": "مسودة",
  "status.confirmed": "مؤكد",
  "status.paid": "مدفوع",
  "status.shipped": "تم الشحن",
  "status.completed": "مكتمل",
  "status.cancelled": "ملغى",
};

const dicts: Record<Lang, Dict> = { en, ar };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string; dir: "ltr" | "rtl" };
const I18nContext = createContext<Ctx | null>(null);

function readInitial(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("lang");
  return stored === "ar" ? "ar" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => { setLangState(readInitial()); }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
    if (lang === "ar") document.documentElement.classList.add("lang-ar");
    else document.documentElement.classList.remove("lang-ar");
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("lang", l);
  };

  const t = (key: string) => dicts[lang][key] ?? dicts.en[key] ?? key;
  const dir = lang === "ar" ? "rtl" : "ltr";
  return <I18nContext.Provider value={{ lang, setLang, t, dir }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
