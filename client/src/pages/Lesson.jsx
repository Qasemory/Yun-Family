// الدرس: محتوى إنجليزي دائماً (كامبردج) داخل صناديق LTR، والمساعدة بالعربي عند الطلب
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fam } from "../lib/paths.js";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Msg, Spinner } from "../components/ui.jsx";

// قراءة بصوت عالي من المتصفح (مجاني، بدون AI)
function speak(text) {
  try {
    const s = window.speechSynthesis; if (!s || !text) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB"; u.rate = 0.9;
    s.speak(u);
  } catch { /* المتصفح ما بيدعم */ }
}
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
const Ar = ({ children }) => children ? <div lang="ar" dir="rtl" className="text-[15px] bg-ivory rounded-lg px-3 py-2 mt-2 font-sans">{children}</div> : null;

export default function Lesson() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isParent } = useAuth();
  const { t } = useT();
  const [l, setL] = useState(null);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [fb, setFb] = useState(null);
  const [ex, setEx] = useState(null);       // شرح إضافي
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [arabic, setArabic] = useState(false);
  const load = () => get(`/study/lesson/${id}`).then(setL);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  if (!l) return <Spinner />;
  const point = l.points[l.currentPoint];
  const progress = { warmup: 5, learn: 15 + (70 * l.currentPoint) / Math.max(l.points.length, 1), exam: 85, summary: 95, done: 100 }[l.stage];
  const run = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch { setErr(t("ai.failed")); } setBusy(false); };
  const start = () => run(async () => { await post(`/study/lesson/${id}/start`); await load(); });
  const sendPoint = (e) => { e.preventDefault(); if (!answer.trim()) return; run(async () => { const r = await post(`/study/lesson/${id}/point`, { answer }); setFb(r); setEx(null); if (r.ok || r.reveal) setAnswer(""); await load(); }); };
  const explain = () => run(async () => { setEx(await post(`/study/lesson/${id}/explain`, { question: ask })); setAsk(""); });
  const sendExam = (e) => { e.preventDefault(); run(async () => { const r = await post(`/study/lesson/${id}/exam`, { answers }); setFb(r); await load(); }); };
  const finish = () => run(async () => { await post(`/study/lesson/${id}/finish`); nav(fam("/study")); });
  const detail = fb?.detail || l.examDetail;
  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      <button onClick={() => nav(fam("/study"))} className="self-start text-sm text-muted">{t("study.back")}</button>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><div className="text-xs text-muted">{t("study.forDay")} <span dir="ltr">{l.forDay}</span></div><div className="font-semibold font-en text-lg" dir="ltr">{l.title}</div></div>
          <button className={`pill ${arabic ? "bg-olive text-white border-transparent" : "pill-gold"}`} onClick={() => setArabic(!arabic)} lang="ar" aria-pressed={arabic}>بالعربي؟</button>
        </div>
        <div className="h-1.5 bg-ivory rounded-full mt-3 overflow-hidden" dir="ltr"><div className="h-full bg-olive" style={{ width: `${progress}%` }} /></div>
        <div className="text-[11px] text-muted mt-1">{t(`study.stage.${l.stage}`, null, l.stage)} · <span dir="ltr">{Math.min(l.currentPoint + 1, l.points.length)}/{l.points.length}</span></div>
      </div>
      {arabic && !point?.ar && <Msg kind="warn"><span lang="ar" dir="rtl">الدرس بالإنجليزي كما بالمدرسة. اقرأ الجملة ببطء، وجاوب بأي كلمات تعرفها. إذا ما فهمت، اضغط Explain again.</span></Msg>}
      {err && <Msg kind="err">{err}</Msg>}

      <div dir="ltr" lang="en" className="flex flex-col gap-4 font-en">
        {l.stage === "warmup" && <Card title="Objective"><div className="reading-en">{l.objective}</div><button className="btn mt-3" onClick={start} disabled={busy}>Start</button></Card>}
        {l.stage === "learn" && point && (
          <Card right={canSpeak && <button type="button" className="pill" onClick={() => speak([point.text, point.explain].filter(Boolean).join(" "))} aria-label="Listen">🔊 Listen</button>}
            title={<span className="pill pill-green">Point {l.currentPoint + 1}</span>}>
            <div className="reading-en">{point.text}</div>
            {point.explain && <div className="reading-en mt-2 text-[16px]">{point.explain}</div>}
            {point.example && <div className="text-sm text-muted mt-2"><b>Example:</b> {point.example}</div>}
            {arabic && <Ar>{point.ar}</Ar>}
            {ex && <div className="mt-3 border-s-4 border-olive ps-3"><div className="reading-en text-[16px]">{ex.text}</div>{canSpeak && <button type="button" className="text-xs text-muted underline mt-1" onClick={() => speak(ex.text)}>🔊 Listen</button>}{arabic && <Ar>{ex.ar}</Ar>}</div>}
            <div className="reading-en mt-4 text-[17px] font-semibold">{point.question}</div>
            {fb && !fb.reveal && fb.currentPoint === l.currentPoint && <div className="mt-3"><Msg kind={fb.ok ? "ok" : "warn"}>{fb.feedback}{arabic && fb.ar && <Ar>{fb.ar}</Ar>}</Msg></div>}
            <form onSubmit={sendPoint} className="flex flex-col sm:flex-row gap-2 mt-3"><input className="flex-1" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" aria-label="Your answer" /><button className="btn" disabled={busy}>{busy ? "…" : "Check"}</button></form>
            <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-line">
              <input className="flex-1 text-sm" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Didn't understand? Ask a question (optional)" aria-label="Ask a question" />
              <button type="button" className="btn-ghost btn-sm" onClick={explain} disabled={busy}>Explain again</button>
            </div>
          </Card>
        )}
        {fb?.reveal && l.stage !== "summary" && <Msg kind="warn">Good try! The answer was: <b>{fb.reveal}</b>. We'll practise it again in your review.</Msg>}
        {l.stage === "exam" && (
          <Card title="Quick check · Cambridge style">
            <form onSubmit={sendExam} className="flex flex-col gap-4">
              {l.exam.map((q, i) => <div key={i}><div className="reading-en text-[17px]"><b>{q.command}</b> — {q.question} <span className="text-muted text-sm">[{q.marks}]</span></div><textarea className="w-full h-24 py-2 mt-1" aria-label={`Answer ${i + 1}`} value={answers[i] || ""} onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }} /></div>)}
              <button className="btn self-start" disabled={busy}>{busy ? "Marking…" : "Submit"}</button>
            </form>
          </Card>
        )}
        {(l.stage === "summary" || l.stage === "done") && (
          <Card title={l.mastered ? "Mastered" : "Almost there"}>
            <div className="text-3xl font-bold text-gold">{l.score}%</div>
            <div className="reading-en mt-2">{l.summary}</div>
            {detail?.length > 0 && <ul className="mt-3 text-sm flex flex-col gap-2">{detail.map((d, i) => <li key={i} className="bg-ivory rounded-lg px-3 py-2"><div className="text-muted">{d.question}</div><div><b>{d.marks}/{d.of}</b>{d.feedback ? ` · ${d.feedback}` : ""}{d.missing?.length ? ` · missing: ${d.missing.join(", ")}` : ""}</div></li>)}</ul>}
            {isParent && l.parentNote && <div lang="ar" dir="rtl" className="mt-3 text-sm bg-ivory rounded-lg px-3 py-2 font-sans"><b>{t("study.parentNote")}:</b> {l.parentNote}</div>}
            {l.stage === "summary" && <button className="btn mt-3" onClick={finish} disabled={busy}>Finish (+20 if mastered)</button>}
          </Card>
        )}
      </div>
    </div>
  );
}
