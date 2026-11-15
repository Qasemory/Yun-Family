// الدرس: محتوى إنجليزي دائماً (كامبردج) داخل صناديق LTR، والواجهة حول الدرس حسب لغة المستخدم
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fam } from "../lib/paths.js";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Card, Msg, Spinner } from "../components/ui.jsx";

export default function Lesson() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { t } = useT();
  const [l, setL] = useState(null);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [fb, setFb] = useState(null);
  const [arabic, setArabic] = useState(false);
  const load = () => get(`/study/lesson/${id}`).then(setL);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  if (!l) return <Spinner />;
  const isNour = (user.grade || "").startsWith("Stage 4");
  const point = l.points[l.currentPoint];
  const progress = { warmup: 5, learn: 15 + (70 * l.currentPoint) / Math.max(l.points.length, 1), exam: 85, summary: 95, done: 100 }[l.stage];
  const start = async () => { await post(`/study/lesson/${id}/start`); load(); };
  const sendPoint = async (e) => { e.preventDefault(); const r = await post(`/study/lesson/${id}/point`, { answer }); setFb(r); setAnswer(""); load(); };
  const sendExam = async (e) => { e.preventDefault(); const r = await post(`/study/lesson/${id}/exam`, { answers }); setFb(r); load(); };
  const finish = async () => { await post(`/study/lesson/${id}/finish`); nav(fam("/study")); };
  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      <button onClick={() => nav(fam("/study"))} className="self-start text-sm text-muted">{t("study.back")}</button>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><div className="text-xs text-muted">{t("study.forDay")} <span dir="ltr">{l.forDay}</span></div><div className="font-semibold font-en text-lg" dir="ltr">{l.title}</div></div>
          {isNour && <button className="pill pill-gold" onClick={() => setArabic(!arabic)} lang="ar">بالعربي؟</button>}
        </div>
        <div className="h-1.5 bg-ivory rounded-full mt-3 overflow-hidden" dir="ltr"><div className="h-full bg-olive" style={{ width: `${progress}%` }} /></div>
        <div className="text-[11px] text-muted mt-1">{t(`study.stage.${l.stage}`, null, l.stage)} · <span dir="ltr">{l.currentPoint + 1}/{l.points.length}</span></div>
      </div>
      {arabic && <Msg kind="warn"><span lang="ar" dir="rtl">الدرس بالإنجليزي كما بالمدرسة. اقرأ الجملة ببطء، وجاوب بأي كلمات تعرفها. بإمكانك تسأل ماما أو بابا عن كلمة واحدة.</span></Msg>}

      <div dir="ltr" lang="en" className="flex flex-col gap-4 font-en">
        {l.stage === "warmup" && <Card title="Objective"><div className="reading-en">{l.objective}</div><button className="btn mt-3" onClick={start}>Start</button></Card>}
        {l.stage === "learn" && point && (
          <Card>
            <span className="pill pill-green mb-2">Point {l.currentPoint + 1}</span>
            <div className="reading-en mt-2">{point.text}</div>
            <div className="reading-en mt-3 text-[17px] text-muted">{point.question}</div>
            {fb && <div className="mt-3"><Msg kind={fb.ok ? "ok" : "warn"}>{fb.feedback}</Msg></div>}
            <form onSubmit={sendPoint} className="flex flex-col sm:flex-row gap-2 mt-3"><input className="flex-1" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" aria-label="Your answer" /><button className="btn">Check</button></form>
          </Card>
        )}
        {l.stage === "exam" && (
          <Card title="Quick check · Cambridge style">
            <form onSubmit={sendExam} className="flex flex-col gap-4">
              {l.exam.map((q, i) => <div key={i}><div className="reading-en text-[17px]"><b>{q.command}</b> — {q.question} <span className="text-muted text-sm">[{q.marks}]</span></div><textarea className="w-full h-24 py-2 mt-1" aria-label={`Answer ${i + 1}`} value={answers[i] || ""} onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }} /></div>)}
              <button className="btn self-start">Submit</button>
            </form>
          </Card>
        )}
        {(l.stage === "summary" || l.stage === "done") && (
          <Card title={l.mastered ? "Mastered" : "Almost there"}>
            <div className="text-3xl font-bold text-gold">{l.score}%</div>
            <div className="reading-en mt-2">{l.summary}</div>
            {fb?.detail && <ul className="mt-2 text-sm text-muted list-disc ps-5">{fb.detail.map((d, i) => <li key={i}>{d.marks}/{d.of}{d.missing.length ? ` · missing: ${d.missing.join(", ")}` : ""}</li>)}</ul>}
            {l.stage === "summary" && <button className="btn mt-3" onClick={finish}>Finish (+20 if mastered)</button>}
          </Card>
        )}
      </div>
    </div>
  );
}
