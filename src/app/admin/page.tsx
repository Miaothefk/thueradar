"use client";

import { useEffect, useState } from "react";

type Feedback = { id: string; kind: string; reason: string | null; status: string; answer: { question: string; answer: string }; user: { email: string } };
type ReviewDocument = {
  id: string; title: string; documentNumber: string | null; documentType: string | null;
  issuingAuthority: string | null; content: string | null; status: string; legalStatus: string;
  validityCheckedAt: string | null; validityEvidenceUrl: string | null; validityMethod: string | null;
  source: { name: string; url: string | null; isOfficial: boolean } | null;
};

export default function AdminPage() {
  const [syncMessage, setSyncMessage] = useState("");
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [documents, setDocuments] = useState<ReviewDocument[]>([]);
  const [error, setError] = useState("");

  async function runSync() {
    setSyncMessage("");
    const response = await fetch("/api/admin/sync", { method: "POST" });
    const body = await response.json();
    setSyncMessage(response.ok ? body.message : body.error || "Không thể xếp lịch đồng bộ.");
  }

  async function loadFeedback() {
    const response = await fetch("/api/admin/ai-feedback");
    const body = await response.json();
    if (response.ok) setFeedback(body.feedback as Feedback[]);
    else setError(body.error || "Không thể tải báo cáo AI.");
  }

  async function loadDocuments() {
    const response = await fetch("/api/admin/documents");
    const body = await response.json();
    if (response.ok) setDocuments(body.documents as ReviewDocument[]);
    else setError(body.error || "Không thể tải văn bản cần kiểm duyệt.");
  }

  async function moderateDocument(id: string, status: "IN_REVIEW" | "VERIFIED") {
    const response = await fetch(`/api/admin/documents/${id}/moderation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) await loadDocuments();
    else setError(((await response.json()) as { error?: string }).error || "Không thể cập nhật văn bản.");
  }

  async function moderate(id: string, status: "IN_REVIEW" | "RESOLVED" | "DISMISSED") {
    const response = await fetch("/api/admin/ai-feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (response.ok) await loadFeedback();
    else setError(((await response.json()) as { error?: string }).error || "Không thể cập nhật báo cáo.");
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/ai-feedback").then(async (response) => {
      const body = await response.json();
      if (!active) return;
      if (response.ok) setFeedback(body.feedback as Feedback[]);
      else setError(body.error || "Không thể tải báo cáo AI.");
    }).catch(() => {
      if (active) setError("Không thể tải báo cáo AI.");
    });
    void fetch("/api/admin/documents").then(async (response) => {
      const body = await response.json();
      if (!active) return;
      if (response.ok) setDocuments(body.documents as ReviewDocument[]);
      else setError(body.error || "Không thể tải văn bản cần kiểm duyệt.");
    }).catch(() => {
      if (active) setError("Không thể tải văn bản cần kiểm duyệt.");
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">Quản trị</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Kiểm duyệt, audit và đồng bộ</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Đồng bộ nguồn pháp luật</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Thao tác này chỉ xếp worker độc lập. Kết quả phải kiểm tra trong SchedulerRun và log, không coi phản hồi HTTP là đồng bộ thành công.</p>
          <button onClick={() => void runSync()} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Xếp worker đồng bộ</button>
          {syncMessage && <p className="mt-3 text-sm text-slate-600">{syncMessage}</p>}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Trạng thái hệ thống</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li>• Kiểm duyệt văn bản chỉ dành cho REVIEWER/ADMIN qua API.</li>
            <li>• Báo cáo AI được lưu và có trạng thái xử lý.</li>
            <li>• Mọi thao tác người dùng và kiểm duyệt được ghi AuditEvent.</li>
          </ul>
        </section>
      </div>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Văn bản chờ kiểm duyệt</h2>
        <p className="mt-2 text-sm text-slate-600">Chỉ chuyển sang VERIFIED sau khi đã đọc nội dung, kiểm tra nguồn và xem trạng thái hiệu lực.</p>
        <div className="mt-4 space-y-4">
          {documents.length === 0 ? <p className="text-sm text-slate-500">Không có văn bản chờ kiểm duyệt.</p> : documents.map((document) => (
            <article key={document.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{document.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{document.documentNumber || "Chưa có số hiệu"} · {document.issuingAuthority || "Chưa rõ cơ quan"} · {document.status}</p>
                </div>
                <span className="h-fit rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">Hiệu lực: {document.legalStatus}</span>
              </div>
              <p className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap text-sm text-slate-700">{document.content || "Chưa có nội dung."}</p>
              <p className="mt-2 text-xs text-slate-500">Phương pháp: {document.validityMethod || "Chưa kiểm tra"}</p>
              {document.validityEvidenceUrl && <a className="mt-1 block text-xs text-emerald-700 underline" href={document.validityEvidenceUrl} target="_blank" rel="noreferrer">Mở bằng chứng nguồn chính thức</a>}
              <div className="mt-3 flex gap-2">
                {document.status === "DRAFT" && <button onClick={() => void moderateDocument(document.id, "IN_REVIEW")} className="rounded-lg border px-3 py-1.5 text-xs">Đưa vào xem xét</button>}
                <button onClick={() => void moderateDocument(document.id, "VERIFIED")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Xác minh và công bố</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Báo cáo câu trả lời AI</h2>
        {error && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <div className="mt-4 space-y-3">
          {feedback.length === 0 ? <p className="text-sm text-slate-500">Chưa có báo cáo hoặc tài khoản hiện tại không có quyền xem.</p> : feedback.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-slate-800">{item.kind} · {item.status}</span><span className="text-slate-500">{item.user.email}</span></div>
              <p className="mt-2 text-slate-700">{item.reason || item.answer.question}</p>
              <p className="mt-1 line-clamp-2 text-slate-500">{item.answer.answer}</p>
              {item.status !== "RESOLVED" && item.status !== "DISMISSED" && <div className="mt-3 flex gap-2"><button onClick={() => void moderate(item.id, "IN_REVIEW")} className="rounded-lg border px-3 py-1.5 text-xs">Đang xem xét</button><button onClick={() => void moderate(item.id, "RESOLVED")} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800">Đã xử lý</button><button onClick={() => void moderate(item.id, "DISMISSED")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs">Bỏ qua</button></div>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
