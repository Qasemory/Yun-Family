import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Card, Msg, Spinner } from "../components/ui.jsx";

export default function Lesson() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
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
  const finish = async () => { await post(`/study/lesson/${id}/finish`); nav("/study"); };
  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="flex items-center justify-between"><div><div className="text-xs text-muted">for {l.forDay}</div><div className="font-semibold font-en" dir="ltr">{l.title}</div></div>
          {isNour && <button className="pill pill-gold" onClick={() => setArabic(!arabic)}>بالعربي؟</button>}</div>
        <div className="h-1.5 bg-ivory rounded-full mt-3 overflow-hidden"><div className="h-full bg-olive" style={{ width: `${progress}%` }} /></div>
        <div className="text-[11px] text-muted mt-1">{l.stage} · {l.currentPoint + 1}/{l.points.length}</div>
      </div>
      {arabic && <Msg kind="warn">الدرس بالإنجليزي كما بالمدرسة. اقرأ الجملة ببطء، وجاوب بأي كلمات تعرفها. بإمكانك تسأل ماما أو بابا عن كلمة واحدة.</Msg>}
      {l.stage === "warmup" && <Card title="Objective"><div className="reading-en">{l.objective}</div><button className="btn mt-3" onClick={start}>Start</button></Card>}
      {l.stage === "learn" && point && (
        <Card>
          <span className="pill pill-green mb-2">Point {l.currentPoint + 1}</span>
          <div className="reading-en mt-2">{point.text}</div>
          <div className="reading-en mt-3 text-[17px] text-muted">{point.question}</div>
          {fb && <Msg kind={fb.ok ? "ok" : "warn"}>{fb.feedback}</Msg>}
          <form onSubmit={sendPoint} className="flex gap-2 mt-3"><input dir="ltr" className="flex-1 font-en" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" /><button className="btn">Check</button></form>
        </Card>
      )}
      {l.stage === "exam" && (
        <Card title="Quick check · Cambridge style">
          <form onSubmit={sendExam} className="flex flex-col gap-3">
            {l.exam.map((q, i) => <div key={i}><div className="reading-en text-[17px]"><b>{q.command}</b> — {q.question} <span className="text-muted text-sm">[{q.marks}]</span></div><textarea dir="ltr" className="w-full h-20 py-2 font-en mt-1" value={answers[i] || ""} onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }} /></div>)}
            <button className="btn">Submit</button>
          </form>
        </Card>
      )}
      {(l.stage === "summary" || l.stage === "done") && (
        <Card title={l.mastered ? "Mastered" : "Almost there"}>
          <div className="text-3xl font-bold text-gold">{l.score}%</div>
          <div className="reading-en mt-2">{l.summary}</div>
          {fb?.detail && <ul className="mt-2 text-sm text-muted list-disc pl-5" dir="ltr">{fb.detail.map((d, i) => <li key={i}>{d.marks}/{d.of}{d.missing.length ? ` · missing: ${d.missing.join(", ")}` : ""}</li>)}</ul>}
          {l.stage === "summary" && <button className="btn mt-3" onClick={finish}>Finish (+20 if mastered)</button>}
        </Card>
      )}
    </div>
  );
}
