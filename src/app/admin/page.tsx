"use client";

import { useEffect, useState } from "react";

type Feedback = { id: string; kind: string; reason: string | null; status: string; answer: { question: string; answer: string }; user: { email: string } };

export default function AdminPage() {
  const [syncMessage, setSyncMessage] = useState("");
  const [feedback, setFeedback] = useState<Feedback[]>([]);
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
