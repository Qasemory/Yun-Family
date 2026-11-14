import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Card, Empty, Spinner, Stat, MemberTabs } from "../components/ui.jsx";

export default function Study() {
  const { user, members, isParent, lang } = useAuth();
  const [sp, setSp] = useSearchParams();
  const u = sp.get("u") || user.id;
  const [d, setD] = useState(null);
  const [book, setBook] = useState({ subject: "Science", title: "" });
  const [page, setPage] = useState({ bookId: "", number: "", text: "" });
  const load = () => get(`/study?u=${u}`).then(setD);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [u]);
  if (!d) return <Spinner />;
  const en = lang !== "ar";
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const addBook = async (e) => { e.preventDefault(); await post("/study/book", { userId: u, ...book }); setBook({ subject: "Science", title: "" }); load(); };
  const addPage = async (e) => { e.preventDefault(); await post(`/study/book/${page.bookId}/page`, { number: page.number, text: page.text }); await post("/study/prepare", { userId: u, bookId: page.bookId, pageNumber: page.number }); setPage({ bookId: "", number: "", text: "" }); load(); };
  return (
    <div className="flex flex-col gap-4">
      {isParent && <MemberTabs members={kids} value={u} onChange={(id) => setSp({ u: id })} />}
      <div className="text-xl font-semibold">{en ? "My study" : "دراستي"} <span className="text-sm text-muted font-normal">Cambridge IG</span></div>
      <div className="grid grid-cols-3 gap-2"><Stat label={en ? "lessons" : "دروس"} value={d.mastery.lessons} /><Stat label={en ? "mastered" : "متقنة"} value={d.mastery.mastered} /><Stat label={en ? "average" : "المعدل"} value={d.mastery.avg != null ? `${d.mastery.avg}%` : "—"} /></div>
      <div className="section">{en ? "Lessons" : "الدروس"}</div>
      {d.lessons.length === 0 && <Empty text={en ? "No lessons yet. A parent adds a page and the lesson is prepared for tomorrow." : "لا دروس بعد. الأهل يضيفون صفحة ويُحضَّر الدرس للغد."} />}
      {d.lessons.map((l) => (
        <Link key={l._id} to={`/lesson/${l._id}`} className="card flex items-center justify-between">
          <div><div className="font-semibold font-en" dir="ltr">{l.title}</div><div className="text-xs text-muted">{en ? "for" : "ليوم"} {l.forDay} · {l.points?.length} {en ? "points" : "نقاط"}</div></div>
          <span className={`pill ${l.stage === "done" ? (l.mastered ? "pill-green" : "pill-gold") : ""}`}>{l.stage === "done" ? `${l.score}%` : l.stage}</span>
        </Link>
      ))}
      {isParent && (
        <>
          <Card title="الكتب"><div className="flex flex-col gap-1 mb-3">{d.books.map((b) => <div key={b._id} className="text-sm">{b.subject} · {b.title}</div>)}</div>
            <form onSubmit={addBook} className="flex gap-2"><select value={book.subject} onChange={(e) => setBook({ ...book, subject: e.target.value })}>{["English", "Maths", "Science", "عربي", "إسلامية"].map((s) => <option key={s}>{s}</option>)}</select><input className="flex-1" placeholder="اسم الكتاب" value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} /><button className="btn-ghost">أضف</button></form></Card>
          <Card title="صفحة الغد ← درس">
            <form onSubmit={addPage} className="flex flex-col gap-2">
              <div className="flex gap-2"><select className="flex-1" value={page.bookId} onChange={(e) => setPage({ ...page, bookId: e.target.value })}><option value="">الكتاب</option>{d.books.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}</select><input className="w-24" type="number" placeholder="صفحة" value={page.number} onChange={(e) => setPage({ ...page, number: e.target.value })} /></div>
              <textarea className="h-28 py-2 font-en" dir="ltr" placeholder="Paste or type the page text (English). With a photo, the AI step converts it to text later." value={page.text} onChange={(e) => setPage({ ...page, text: e.target.value })} />
              <button className="btn" disabled={!page.bookId || !page.text}>حضّر درس الغد</button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
