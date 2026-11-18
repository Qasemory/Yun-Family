import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fam } from "../lib/paths.js";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useT } from "../lib/i18n.js";
import { Empty, Spinner, Stat, MemberTabs, PageTitle, Msg } from "../components/ui.jsx";
import StudyPlan from "../components/StudyPlan.jsx";
import StudyBooks from "../components/StudyBooks.jsx";

export default function Study() {
  const { user, members, isParent } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const kids = members.filter((m) => ["child", "teen_adult"].includes(m.role));
  const u = sp.get("u") || (isParent ? kids[0]?.id : null) || user.id;
  const tab = isParent ? (sp.get("tab") || "lessons") : "lessons";
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = () => get(`/study?u=${u}`).then(setD);
  useEffect(() => { load(); setMsg(null); /* eslint-disable-next-line */ }, [u]);
  if (!d) return <Spinner />;
  const go = (patch) => setSp({ ...Object.fromEntries(sp), ...patch });
  const review = async () => {
    setBusy(true);
    try { const r = await post("/study/review", { userId: u }); nav(fam(`/lesson/${r._id}`)); } catch { setMsg({ kind: "err", text: t("ai.failed") }); setBusy(false); }
  };
  const tabs = [["lessons", `📚 ${t("study.lessonsTitle")}`], ["plan", `🗓️ ${t("plan.tab")}`], ["books", `📖 ${t("study.books")}`]];
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {isParent && <MemberTabs members={kids} value={u} onChange={(id) => go({ u: id })} />}
      <PageTitle right={tab === "lessons" && d.reviewable > 0 && <button className="btn btn-sm" onClick={review} disabled={busy} title={t("study.reviewHint")}>{t("study.review", { n: d.reviewable })}</button>}>{t("nav.study")} <span className="text-sm text-muted font-normal" dir="ltr">Cambridge IG</span></PageTitle>
      {isParent && (
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={`shrink-0 ${tab === k ? "btn btn-sm" : "btn-ghost btn-sm"}`} onClick={() => go({ tab: k })}>{label}</button>)}
        </div>
      )}
      {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}

      {tab === "lessons" && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xl"><Stat label={t("study.lessons")} value={d.mastery.lessons} /><Stat label={t("study.mastered")} value={d.mastery.mastered} /><Stat label={t("study.average")} value={d.mastery.avg != null ? `${d.mastery.avg}%` : "—"} /></div>
          {d.lessons.length === 0 && <Empty text={isParent ? t("study.emptyParent") : t("study.empty")} />}
          <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.lessons.map((l) => (
              <Link key={l._id} to={fam(`/lesson/${l._id}`)} className="card flex flex-col gap-2 hover:border-olive transition min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><div className="font-semibold font-en truncate" dir="ltr">{l.title}</div><div className="text-xs text-muted">{l.isReview && <span className="pill pill-gold me-1">{t("study.reviewTag")}</span>}{t("study.forDay")} <span dir="ltr">{l.forDay}</span> · {t("study.pointsN", { n: l.points?.length || 0 })}</div></div>
                  <span className={`pill shrink-0 ${l.stage === "done" ? (l.mastered ? "pill-green" : "pill-gold") : ""}`}>{l.stage === "done" ? `${l.score}%` : t(`study.stage.${l.stage}`, null, l.stage)}</span>
                </div>
                {isParent && l.parentNote && <div className="text-xs bg-ivory rounded-lg px-2 py-1.5"><b>{t("study.parentNote")}:</b> {l.parentNote}</div>}
              </Link>
            ))}
          </div>
        </>
      )}
      {tab === "plan" && <StudyPlan u={u} books={d.books} />}
      {tab === "books" && <StudyBooks u={u} data={d} onChange={load} />}
    </div>
  );
}
