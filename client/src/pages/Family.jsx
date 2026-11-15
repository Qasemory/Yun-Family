import { useEffect, useRef, useState } from "react";
import { shrinkImage } from "../lib/image.js";
import { get, post, imgSrc } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Empty, PageTitle, Spinner, Msg } from "../components/ui.jsx";

export default function Family() {
  const { isParent } = useAuth();
  const { t, locale } = useT();
  const [d, setD] = useState(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const load = () => get("/family").then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <Spinner />;
  const pick = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setPhoto(await shrinkImage(f, 1280, 0.8)); } catch { setErr(t("common.badImage")); } };
  const send = async (e) => {
    e.preventDefault(); if (!text.trim() && !photo) return;
    setBusy(true); setErr("");
    try { await post("/family", { text, image: photo || undefined }); setText(""); setPhoto(""); load(); } catch { setErr(t("common.notSaved")); }
    setBusy(false);
  };
  const touch = async (id, kind) => { await post(`/family/${id}/touch`, { kind }); load(); };
  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      <PageTitle>{t("nav.family")}</PageTitle>
      <form onSubmit={send} className="card flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="flex-1" placeholder={t("feed.placeholder")} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
            <button type="button" className="btn-ghost flex-1 sm:flex-none" onClick={() => fileRef.current?.click()} aria-label={t("feed.photo")}>📷 {t("feed.photo")}</button>
            <button className="btn flex-1 sm:flex-none" disabled={busy || (!text.trim() && !photo)}>{busy ? "…" : t("feed.post")}</button>
          </div>
        </div>
        {photo && <div className="flex items-center gap-2"><img src={photo} alt="" className="w-16 h-16 rounded-lg object-cover" /><button type="button" className="text-xs text-muted underline" onClick={() => setPhoto("")}>{t("common.remove")}</button></div>}
        {err && <Msg kind="err">{err}</Msg>}
      </form>
      {d.posts.length === 0 && <Empty text={t("feed.empty")} />}
      {d.posts.map((p) => (
        <Card key={p._id}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 shrink-0 rounded-full text-white flex items-center justify-center text-sm font-bold" style={{ background: p.author?.color }}>{p.author?.displayName?.[0]}</span>
            <div className="min-w-0"><div className="font-semibold text-sm">{p.author?.displayName}</div><div className="text-xs text-muted">{new Date(p.createdAt).toLocaleString(locale)}</div></div>
            {p.status === "pending" && <span className="pill pill-gold ms-auto">{t("feed.awaitingApproval")}</span>}
          </div>
          {p.imageUrl && <img src={imgSrc(p.imageUrl)} alt="" loading="lazy" className="rounded-xl mb-2 w-full" />}
          <div className="reading text-[17px]" dir="auto">{p.text}</div>
          {isParent && p.note && <div className="text-xs bg-[#F6E8D2] text-[#8A5612] rounded-lg px-2 py-1.5 mt-2"><b>{t("feed.note")}:</b> {p.note}</div>}
          {p.status === "pending" && isParent ? <button className="btn btn-sm mt-2" onClick={async () => { await post(`/family/${p._id}/approve`); load(); }}>{t("feed.approve")}</button> : (
            <div className="flex flex-wrap gap-1 mt-3">{Object.entries(d.touches).map(([k, l]) => { const n = p.touches.filter((x) => x.kind === k).length; return <button key={k} className="pill" onClick={() => touch(p._id, k)}>{l}{n ? ` · ${n}` : ""}</button>; })}</div>
          )}
        </Card>
      ))}
    </div>
  );
}
