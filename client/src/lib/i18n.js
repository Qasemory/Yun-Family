const S = {
  ar: { home: "الرئيسية", tasks: "مهامي", prayer: "صلاتي", study: "دراستي", health: "صحتي", family: "عيلتنا", shop: "متجري", settings: "الإعدادات", logout: "خروج",
    today: "اليوم", points: "نقاط", balance: "الرصيد", fun: "الترفيه", unlocked: "مفتوح", locked: "مقفل بعد", done: "تم", pending: "بانتظار التأكيد", mark: "خلصت", confirm: "تأكيد",
    whoAreYou: "مين إنت؟", password: "كلمة السر", pin: "رمز الدخول", enter: "دخول", wrong: "بيانات غير صحيحة", locked15: "مقفل ١٥ دقيقة بعد ٣ محاولات", familyToday: "العائلة اليوم" },
  en: { home: "Home", tasks: "My tasks", prayer: "My prayer", study: "My study", health: "My health", family: "Our family", shop: "My shop", settings: "Settings", logout: "Log out",
    today: "Today", points: "points", balance: "Balance", fun: "Fun time", unlocked: "unlocked", locked: "locked until", done: "Done", pending: "Waiting for confirmation", mark: "Done!", confirm: "Confirm",
    whoAreYou: "Who are you?", password: "Password", pin: "PIN", enter: "Enter", wrong: "Wrong details", locked15: "Locked 15 minutes after 3 tries", familyToday: "Family today" },
};
export function t(lang, key) { const l = lang === "en" ? "en" : lang === "mixed" ? "en" : "ar"; return S[l][key] ?? S.ar[key] ?? key; }
export const dirFor = (lang) => (lang === "ar" ? "rtl" : "ltr");
export const ROLE_AR = { owner: "الأب", admin: "الأم", child: "ولد", teen_adult: "مراهق", relative: "قريب", helper: "مساعد", guest: "ضيف" };
