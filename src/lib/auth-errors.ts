// Maps Supabase auth error messages to bilingual, user-friendly strings.
// Pass a raw error (or its .message) plus the current language.

export type AuthLang = "ar" | "en";

type Pair = { ar: string; en: string };

const RULES: Array<{ match: RegExp; msg: Pair }> = [
  {
    match: /invalid login credentials|invalid.*email.*password|invalid grant/i,
    msg: {
      ar: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      en: "Incorrect email or password.",
    },
  },
  {
    match: /user already registered|already registered|already exists|duplicate key|users_email_key/i,
    msg: {
      ar: "هذا البريد الإلكتروني مسجّل مسبقًا. جرّب تسجيل الدخول أو استعادة كلمة المرور.",
      en: "This email is already registered. Try signing in or resetting your password.",
    },
  },
  {
    match: /password.*(should be|must be).*(at least )?(6|8)|password.*too short|weak.?password|password.*strength|password.*characters/i,
    msg: {
      ar: "كلمة المرور ضعيفة جدًا. يجب أن تحتوي على 8 أحرف على الأقل مع أرقام وأحرف مختلفة.",
      en: "Password is too weak. Use at least 8 characters with a mix of letters and numbers.",
    },
  },
  {
    match: /pwned|compromis|breach/i,
    msg: {
      ar: "كلمة المرور هذه ظهرت في تسريبات بيانات معروفة. يُرجى اختيار كلمة مرور أخرى.",
      en: "This password appeared in a known data breach. Please choose a different one.",
    },
  },
  {
    match: /email.*not.*confirm|confirm.*email|email address not confirmed/i,
    msg: {
      ar: "لم يتم تأكيد البريد الإلكتروني بعد. يُرجى التحقق من بريدك.",
      en: "Email not confirmed yet. Please check your inbox to verify your account.",
    },
  },
  {
    match: /invalid.*email|email.*invalid|unable to validate email/i,
    msg: {
      ar: "البريد الإلكتروني غير صالح.",
      en: "Invalid email address.",
    },
  },
  {
    match: /rate limit|too many requests/i,
    msg: {
      ar: "عدد محاولات كثير جدًا. يُرجى المحاولة بعد قليل.",
      en: "Too many attempts. Please try again shortly.",
    },
  },
  {
    match: /network|failed to fetch|timeout/i,
    msg: {
      ar: "تعذّر الاتصال بالخادم. تحقّق من الإنترنت وحاول مجددًا.",
      en: "Network error. Check your connection and try again.",
    },
  },
  {
    match: /signup.*disabled|signups.*not allowed/i,
    msg: {
      ar: "تسجيل الحسابات الجديدة معطّل حاليًا.",
      en: "New sign-ups are currently disabled.",
    },
  },
  {
    match: /session|jwt|expired/i,
    msg: {
      ar: "انتهت الجلسة. يُرجى تسجيل الدخول مرة أخرى.",
      en: "Session expired. Please sign in again.",
    },
  },
];

export function translateAuthError(err: unknown, lang: AuthLang): string {
  const raw =
    (err && typeof err === "object" && "message" in err && (err as any).message) ||
    (typeof err === "string" ? err : "") ||
    "";
  const text = String(raw);
  for (const rule of RULES) {
    if (rule.match.test(text)) return rule.msg[lang];
  }
  // Fallback: return raw text when English, generic Arabic message otherwise
  return lang === "ar"
    ? "حدث خطأ غير متوقّع أثناء المصادقة. حاول مرة أخرى."
    : text || "Authentication error. Please try again.";
}
