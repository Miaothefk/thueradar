"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Feedback = {
  id: string;
  kind: string;
  reason: string | null;
  status: string;
  answer: { question: string; answer: string };
  user: { email: string };
};

type Overview = {
  pendingDocuments: number;
  inReviewDocuments: number;
  verifiedDocuments: number;
  openFeedback: number;
  resolvedFeedback: number;
  lastSchedulerRun: {
    status: string;
    trigger: string;
    attempt: number;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
  } | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "feedback">("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadOverview() {
    const response = await fetch("/api/admin/overview");
    const body = await response.json();
    if (response.ok) setOverview(body as Overview);
  }

  async function loadFeedback() {
    const response = await fetch("/api/admin/ai-feedback");
    const body = await response.json();
    if (response.ok) setFeedback(body.feedback as Feedback[]);
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      const accountResponse = await fetch("/api/auth/me");
      const accountBody = await accountResponse.json();
      if (!active) return;
      if (accountBody.user?.role !== "ADMIN") {
        router.replace(accountBody.user ? "/documents" : "/login");
        return;
      }
      await Promise.all([loadOverview(), loadFeedback()]);
      if (active) setLoading(false);
    }
    void initialize();
    return () => { active = false; };
  }, [router]);

  async function moderateFeedback(id: string, status: "IN_REVIEW" | "RESOLVED" | "DISMISSED") {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/ai-feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const body = await response.json();
    if (response.ok) {
      setMessage("Da cap nhat trang thai bao cao.");
      await Promise.all([loadFeedback(), loadOverview()]);
    } else {
      setError(body.error || "Khong the cap nhat bao cao.");
    }
  }

  async function runSync() {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/sync", { method: "POST" });
    const body = await response.json();
    if (response.ok) setMessage("Da xep lich dong bo. Ket qua phai duoc kiem tra trong SchedulerRun.");
    else setError(body.error || "Khong the xep lich dong bo.");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">Dang kiem tra quyen quan tri...</div>
      </main>
    );
  }

  const cards = [
    { label: "Van ban da cong bo", value: overview?.verifiedDocuments ?? 0, color: "emerald" },
    { label: "Bao cao AI mo", value: overview?.openFeedback ?? 0, color: "red" },
    { label: "Bao cao da xu ly", value: overview?.resolvedFeedback ?? 0, color: "blue" },
  ];

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-700">Bang dieu khien</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Quan tri ThueRadar</h1>
            <p className="mt-2 text-sm text-slate-600">Van ban duoc AI va crawler cong bo tu dong; admin tap trung vao phan hoi va van hanh.</p>
          </div>
          <button type="button" onClick={() => void runSync()} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">
            Dong bo nguon phap luat
          </button>
        </div>

        {(message || error) && (
          <div className={`mt-5 rounded-xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
            {error || message}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <section key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{card.label}</p>
              <p className={`mt-2 text-3xl font-bold ${card.color === "red" ? "text-red-700" : card.color === "blue" ? "text-blue-700" : "text-emerald-700"}`}>{card.value}</p>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Trang thai dong bo gan nhat</p>
              <p className="mt-1 text-sm text-slate-600">
                {overview?.lastSchedulerRun ? `${overview.lastSchedulerRun.status} - ${overview.lastSchedulerRun.trigger} - lan thu ${overview.lastSchedulerRun.attempt}` : "Chua co ban ghi SchedulerRun."}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${overview?.lastSchedulerRun?.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {overview?.lastSchedulerRun?.status || "CHUA CHAY"}
            </span>
          </div>
          {overview?.lastSchedulerRun?.error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{overview.lastSchedulerRun.error}</p>}
        </section>

        <div className="mt-6 flex gap-2 border-b border-slate-200">
          <button type="button" onClick={() => setTab("overview")} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "overview" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600"}`}>
            Tong quan
          </button>
          <button type="button" onClick={() => setTab("feedback")} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "feedback" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600"}`}>
            Bao cao khach hang ({feedback.filter((item) => item.status === "OPEN" || item.status === "IN_REVIEW").length})
          </button>
        </div>

        {tab === "overview" ? (
          <section className="mt-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Hoat dong tu dong</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Crawler lay va AI phan tich van ban tu GDT tu dong. Van ban duoc cong bo khi du du lieu; neu khong du bang chung hieu luc se la UNKNOWN. Admin chi quan tri phan hoi va cau hinh van hanh.</p>
            </div>
          </section>
        ) : (
          <section className="mt-5 space-y-4">
            {feedback.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">Chua co bao cao tu khach hang.</div>
            ) : feedback.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{item.kind === "REPORT" ? "Bao cao cau tra loi" : "Danh gia cau tra loi"}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.user.email}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{item.status}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">{item.answer.question}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.reason || item.answer.answer}</p>
                {item.status !== "RESOLVED" && item.status !== "DISMISSED" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.status !== "IN_REVIEW" && <button type="button" onClick={() => void moderateFeedback(item.id, "IN_REVIEW")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Dang xem xet</button>}
                    <button type="button" onClick={() => void moderateFeedback(item.id, "RESOLVED")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Da xu ly</button>
                    <button type="button" onClick={() => void moderateFeedback(item.id, "DISMISSED")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Bo qua</button>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
