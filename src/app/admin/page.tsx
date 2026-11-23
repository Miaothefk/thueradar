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

type ReviewDocument = {
  id: string;
  title: string;
  documentNumber: string | null;
  documentType: string | null;
  issuingAuthority: string | null;
  content: string | null;
  status: string;
  legalStatus: string;
  validityCheckedAt: string | null;
  validityEvidenceUrl: string | null;
  validityMethod: string | null;
  source: { name: string; url: string | null; isOfficial: boolean } | null;
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
  const [tab, setTab] = useState<"documents" | "feedback">("documents");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [documents, setDocuments] = useState<ReviewDocument[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadOverview() {
    const response = await fetch("/api/admin/overview");
    const body = await response.json();
    if (response.ok) setOverview(body as Overview);
  }

  async function loadDocuments() {
    const response = await fetch("/api/admin/documents");
    const body = await response.json();
    if (response.ok) setDocuments(body.documents as ReviewDocument[]);
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
        router.replace(accountBody.user ? "/" : "/login");
        return;
      }
      await Promise.all([loadOverview(), loadDocuments(), loadFeedback()]);
      if (active) setLoading(false);
    }
    void initialize();
    return () => { active = false; };
  }, [router]);

  async function moderateDocument(id: string, status: "IN_REVIEW" | "VERIFIED") {
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/documents/${id}/moderation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await response.json();
    if (response.ok) {
      setMessage(status === "VERIFIED" ? "Văn bản đã được xác minh và công bố." : "Văn bản đã chuyển sang trạng thái đang xem xét.");
      await Promise.all([loadDocuments(), loadOverview()]);
    } else {
      setError(body.error || "Không thể cập nhật văn bản.");
    }
  }

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
      setMessage("Trạng thái báo cáo đã được cập nhật.");
      await Promise.all([loadFeedback(), loadOverview()]);
    } else {
      setError(body.error || "Không thể cập nhật báo cáo.");
    }
  }

  async function runSync() {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/sync", { method: "POST" });
    const body = await response.json();
    if (response.ok) setMessage("Yêu cầu đồng bộ đã được xếp worker. Kiểm tra GitHub Actions hoặc trạng thái chạy gần nhất.");
    else setError(body.error || "Không thể xếp lịch đồng bộ.");
  }

  const cards = [
    { label: "Chờ duyệt", value: overview?.pendingDocuments ?? 0, color: "amber" },
    { label: "Đang xem xét", value: overview?.inReviewDocuments ?? 0, color: "blue" },
    { label: "Đã công bố", value: overview?.verifiedDocuments ?? 0, color: "emerald" },
    { label: "Báo cáo AI mở", value: overview?.openFeedback ?? 0, color: "red" },
  ];

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">Đang kiểm tra quyền quản trị…</div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-700">Bảng điều khiển</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Quản trị ThueRadar</h1>
            <p className="mt-2 text-sm text-slate-600">Kiểm duyệt nguồn, theo dõi báo cáo và giám sát đồng bộ dữ liệu.</p>
          </div>
          <button
            type="button"
            onClick={() => void runSync()}
            className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
          >
            Đồng bộ nguồn pháp luật
          </button>
        </div>

        {(message || error) && (
          <div className={`mt-5 rounded-xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
            {error || message}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <section key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{card.label}</p>
              <p className={`mt-2 text-3xl font-bold ${card.color === "amber" ? "text-amber-700" : card.color === "blue" ? "text-blue-700" : card.color === "red" ? "text-red-700" : "text-emerald-700"}`}>{card.value}</p>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Trạng thái đồng bộ gần nhất</p>
              <p className="mt-1 text-sm text-slate-600">
                {overview?.lastSchedulerRun ? `${overview.lastSchedulerRun.status} · ${overview.lastSchedulerRun.trigger} · lần thử ${overview.lastSchedulerRun.attempt}` : "Chưa có bản ghi SchedulerRun."}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${overview?.lastSchedulerRun?.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : overview?.lastSchedulerRun?.status ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
              {overview?.lastSchedulerRun?.status || "CHƯA CHẠY"}
            </span>
          </div>
          {overview?.lastSchedulerRun?.error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{overview.lastSchedulerRun.error}</p>}
        </section>

        <div className="mt-6 flex gap-2 border-b border-slate-200">
          <button type="button" onClick={() => setTab("documents")} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "documents" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
            Duyệt văn bản ({documents.length})
          </button>
          <button type="button" onClick={() => setTab("feedback")} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === "feedback" ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
            Báo cáo khách hàng ({feedback.filter((item) => item.status === "OPEN" || item.status === "IN_REVIEW").length})
          </button>
        </div>

        {tab === "documents" ? (
          <section className="mt-5 space-y-4">
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">Không có văn bản chờ kiểm duyệt.</div>
            ) : documents.map((document) => (
              <article key={document.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{document.documentType || "Văn bản"}{document.documentNumber ? ` · ${document.documentNumber}` : ""}</p>
                    <h2 className="mt-2 text-lg font-bold text-slate-950">{document.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{document.issuingAuthority || "Chưa rõ cơ quan ban hành"}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{document.status}</span>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="max-h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 whitespace-pre-wrap">
                    {document.content || "Chưa có nội dung trích xuất."}
                  </div>
                  <aside className="rounded-xl border border-slate-200 p-4 text-sm">
                    <p className="font-bold text-slate-900">Kiểm tra hiệu lực</p>
                    <p className="mt-2 text-slate-700">Trạng thái: <strong>{document.legalStatus}</strong></p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{document.validityMethod || "Chưa có phương pháp kiểm tra."}</p>
                    {document.validityEvidenceUrl && (
                      <a href={document.validityEvidenceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50">
                        Mở bằng chứng chính thức
                      </a>
                    )}
                  </aside>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.status === "DRAFT" && (
                    <button type="button" onClick={() => void moderateDocument(document.id, "IN_REVIEW")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      Đưa vào xem xét
                    </button>
                  )}
                  <button type="button" onClick={() => void moderateDocument(document.id, "VERIFIED")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                    Xác minh và công bố
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-5 space-y-4">
            {feedback.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">Chưa có báo cáo từ khách hàng.</div>
            ) : feedback.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{item.kind === "REPORT" ? "Báo cáo câu trả lời" : "Đánh giá câu trả lời"}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.user.email}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{item.status}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">{item.answer.question}</p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.reason || item.answer.answer}</p>
                {item.status !== "RESOLVED" && item.status !== "DISMISSED" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.status !== "IN_REVIEW" && <button type="button" onClick={() => void moderateFeedback(item.id, "IN_REVIEW")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Đang xem xét</button>}
                    <button type="button" onClick={() => void moderateFeedback(item.id, "RESOLVED")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Đã xử lý</button>
                    <button type="button" onClick={() => void moderateFeedback(item.id, "DISMISSED")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Bỏ qua</button>
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
