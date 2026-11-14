import { useEffect, useState } from "react";
import { get, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { Card, Empty, Spinner } from "../components/ui.jsx";

export default function Family() {
  const { user, isParent } = useAuth();
  const [d, setD] = useState(null);
  const [text, setText] = useState("");
  const load = () => get("/family").then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <Spinner />;
  const send = async (e) => { e.preventDefault(); if (!text.trim()) return; await post("/family", { text }); setText(""); load(); };
  const touch = async (id, kind) => { await post(`/family/${id}/touch`, { kind }); load(); };
  return (
    <div className="flex flex-col gap-4">
      <div className="text-xl font-semibold">عيلتنا</div>
      <form onSubmit={send} className="card flex gap-2"><input className="flex-1" placeholder="شارك لحظة اليوم…" value={text} onChange={(e) => setText(e.target.value)} /><button className="btn">نشر</button></form>
      {d.posts.length === 0 && <Empty text="لا منشورات بعد" />}
      {d.posts.map((p) => (
        <Card key={p._id}>
          <div className="flex items-center gap-2 mb-2"><span className="w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold" style={{ background: p.author?.color }}>{p.author?.displayName?.[0]}</span><div><div className="font-semibold text-sm">{p.author?.displayName}</div><div className="text-xs text-muted">{new Date(p.createdAt).toLocaleString("ar-JO")}</div></div>
            {p.status === "pending" && <span className="pill pill-gold mr-auto">بانتظار الموافقة</span>}</div>
          {p.imageUrl && <img src={p.imageUrl} alt="" className="rounded-xl mb-2" />}
          <div className="reading text-[17px]">{p.text}</div>
          {p.status === "pending" && isParent ? <button className="btn btn-sm mt-2" onClick={async () => { await post(`/family/${p._id}/approve`); load(); }}>وافق على النشر</button> : (
            <div className="flex flex-wrap gap-1 mt-3">{Object.entries(d.touches).map(([k, l]) => <button key={k} className="pill" onClick={() => touch(p._id, k)}>{l}{p.touches.filter((t) => t.kind === k).length ? ` · ${p.touches.filter((t) => t.kind === k).length}` : ""}</button>)}</div>
          )}
        </Card>
      ))}
    </div>
  );
}
