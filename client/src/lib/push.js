// إشعارات الموبايل من المتصفح (Web Push): بدون رقم ولا تطبيق إضافي
import { api } from "./api.js";

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
/** الآيفون: الإشعارات بتشتغل بس لما التطبيق مضاف للشاشة الرئيسية */
export const needsHomeScreen = () => isIOS() && !isStandalone();
export const permission = () => (typeof Notification !== "undefined" ? Notification.permission : "denied");

export function registerSW() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
}

function keyToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const deviceName = () => {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? "Android" : isIOS() ? (/iPad/.test(ua) || navigator.maxTouchPoints > 1 && /Mac/.test(ua) ? "iPad" : "iPhone") : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Linux";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /Firefox/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "";
  return `${os}${br ? ` · ${br}` : ""}`;
};

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** يطلب الإذن ويسجّل الجهاز. يرجع "on" | "denied" | "unsupported" | "ios_home" */
export async function enablePush() {
  if (needsHomeScreen()) return "ios_home";
  if (!pushSupported()) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = (await navigator.serviceWorker.getRegistration("/")) || (await registerSW());
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;
  const { publicKey } = await api("/push/key", { auth: false });
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  await api("/push/subscribe", { method: "POST", body: { subscription: sub.toJSON(), device: deviceName() } });
  return "on";
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) { await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
}

/** بعد الدخول: لو الجهاز مشترك أصلاً، نتأكد إنه مربوط بالحساب الحالي (تابلت مشترك بين الأولاد) */
export async function syncPush() {
  try {
    if (permission() !== "granted") return;
    const sub = await currentSubscription();
    if (sub) await api("/push/subscribe", { method: "POST", body: { subscription: sub.toJSON(), device: deviceName() } });
  } catch { /* مش مهم */ }
}

/** عند الخروج: هالجهاز ما يضل يستقبل إشعارات الحساب اللي طلع */
export async function unlinkOnLogout() {
  try { const sub = await currentSubscription(); if (sub) await api("/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }); } catch { /* مش مهم */ }
}

/** يضيف رابط الـ manifest وأيقونة الآيفون لصفحات العيلة فقط (مش للمتجر العام) */
export function addFamilyManifest() {
  if (typeof document === "undefined" || document.getElementById("fam-manifest")) return;
  const add = (attrs) => { const l = document.createElement("link"); Object.assign(l, attrs); document.head.appendChild(l); };
  add({ id: "fam-manifest", rel: "manifest", href: "/manifest.webmanifest" });
  add({ rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" });
  for (const [name, content] of [["apple-mobile-web-app-capable", "yes"], ["mobile-web-app-capable", "yes"], ["apple-mobile-web-app-title", "عيلتنا"], ["apple-mobile-web-app-status-bar-style", "default"]]) {
    const m = document.createElement("meta"); m.name = name; m.content = content; document.head.appendChild(m);
  }
}
