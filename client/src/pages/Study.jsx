import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fam } from "../lib/paths.js";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Empty, Spinner, Stat, MemberTabs, PageTitle } from "../components/ui.jsx";

const SUBJECTS = ["English", "Maths", "Science", "عربي", "إسلامية"];

export default function Study() {
  const { user, members, isParent } = useAuth();
  const { t } = useT();
  const [sp, setSp] = useSearchParams();
  const u = sp.get("u") || user.id;
  const [d, setD] = useState(null);
  const [book, setBook] = useState({ subject: "Science", title: "" });
  const [page, setPage] = useState({ bookId: "", number: "", text: "" });
  const load = () => get(`/study?u=${u}`).then(setD);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [u]);
  if (!d) return <Spinner />;
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const addBook = async (e) => { e.preventDefault(); await post("/study/book", { userId: u, ...book }); setBook({ subject: "Science", title: "" }); load(); };
  const addPage = async (e) => { e.preventDefault(); await post(`/study/book/${page.bookId}/page`, { number: page.number, text: page.text }); await post("/study/prepare", { userId: u, bookId: page.bookId, pageNumber: page.number }); setPage({ bookId: "", number: "", text: "" }); load(); };
  return (
    <div className="flex flex-col gap-4">
      {isParent && <MemberTabs members={kids} value={u} onChange={(id) => setSp({ u: id })} />}
      <PageTitle>{t("nav.study")} <span className="text-sm text-muted font-normal" dir="ltr">Cambridge IG</span></PageTitle>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xl"><Stat label={t("study.lessons")} value={d.mastery.lessons} /><Stat label={t("study.mastered")} value={d.mastery.mastered} /><Stat label={t("study.average")} value={d.mastery.avg != null ? `${d.mastery.avg}%` : "—"} /></div>
      <div className="section">{t("study.lessonsTitle")}</div>
      {d.lessons.length === 0 && <Empty text={t("study.empty")} />}
      <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
        {d.lessons.map((l) => (
          <Link key={l._id} to={fam(`/lesson/${l._id}`)} className="card flex items-center justify-between gap-3 hover:border-olive transition">
            <div className="min-w-0"><div className="font-semibold font-en truncate" dir="ltr">{l.title}</div><div className="text-xs text-muted">{t("study.forDay")} <span dir="ltr">{l.forDay}</span> · {t("study.pointsN", { n: l.points?.length || 0 })}</div></div>
            <span className={`pill shrink-0 ${l.stage === "done" ? (l.mastered ? "pill-green" : "pill-gold") : ""}`}>{l.stage === "done" ? `${l.score}%` : t(`study.stage.${l.stage}`, null, l.stage)}</span>
          </Link>
        ))}
      </div>
      {isParent && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start mt-2">
          <Card title={t("study.books")}>
            <div className="flex flex-col gap-1 mb-3">{d.books.map((b) => <div key={b._id} className="text-sm"><span dir="auto">{b.subject}</span> · <span dir="auto">{b.title}</span></div>)}</div>
            <form onSubmit={addBook} className="flex flex-col sm:flex-row gap-2"><select value={book.subject} onChange={(e) => setBook({ ...book, subject: e.target.value })} aria-label={t("study.subject")}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select><input className="flex-1" placeholder={t("study.bookName")} value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} /><button className="btn-ghost">{t("common.add")}</button></form>
          </Card>
          <Card title={t("study.pageToLesson")}>
            <form onSubmit={addPage} className="flex flex-col gap-2">
              <div className="flex gap-2"><select className="flex-1" value={page.bookId} onChange={(e) => setPage({ ...page, bookId: e.target.value })} aria-label={t("study.book")}><option value="">{t("study.book")}</option>{d.books.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}</select><input className="w-24" type="number" inputMode="numeric" placeholder={t("study.page")} aria-label={t("study.page")} value={page.number} onChange={(e) => setPage({ ...page, number: e.target.value })} /></div>
              <textarea className="h-32 py-2 font-en" dir="ltr" placeholder="Paste or type the page text (English). With a photo, the AI step converts it to text later." value={page.text} onChange={(e) => setPage({ ...page, text: e.target.value })} />
              <button className="btn" disabled={!page.bookId || !page.text}>{t("study.prepare")}</button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
