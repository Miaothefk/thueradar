"use client";

import { FormEvent, useState } from "react";

type Citation = { citationId: string; title: string; documentNumber: string | null; sourceName: string; sourceUrl: string | null };
type AnswerResult = { status: string; answer?: string; citations?: Citation[]; error?: string; errorCode?: string; answerId?: string };

export default function AiPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  async function ask(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const body = await response.json() as AnswerResult;
      setResult(response.ok || body.status !== "NOT_CONFIGURED" ? body : { ...body, error: body.error || "Không thể xử lý câu hỏi." });
    } catch {
      setResult({ status: "PROVIDER_ERROR", error: "Không thể kết nối dịch vụ AI." });
    } finally {
      setLoading(false);
    }

  }

  async function sendFeedback(kind: "RATING" | "REPORT", payload: Record<string, unknown>) {
    if (!result?.answerId) return;
    const response = await fetch("/api/ai/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answerId: result.answerId, kind, ...payload }) });
    const body = await response.json();
    setFeedbackMessage(response.ok ? "Đã lưu phản hồi vào hệ thống." : body.error || "Không thể lưu phản hồi.");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">AI hỗ trợ</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Hỏi đáp pháp luật thuế theo hướng dẫn RAG</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Câu trả lời chỉ được hiển thị khi truy hồi được văn bản đã xác minh và vượt qua kiểm tra citation. Hệ thống không tự tạo nguồn thay thế.</p>
      </div>
      <div className="rounded-3xl border border-slate-300 bg-white p-6 shadow-md">
        <form onSubmit={ask}>
          <label htmlFor="question" className="text-sm font-bold text-slate-800">Câu hỏi pháp lý</label>
          <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ví dụ: Quy định nào trong các văn bản đã lưu liên quan đến…?" className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-slate-600">AI provider chạy phía server; API key không được gửi xuống trình duyệt.</p>
            <button type="submit" disabled={loading || !question.trim()} className="shrink-0 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">{loading ? "Đang kiểm tra…" : "Gửi câu hỏi"}</button>
          </div>
        </form>
        {result && (
          <div className="mt-6 space-y-5">
            <div className={`rounded-2xl p-5 text-sm leading-6 ${result.status === "ANSWERED" ? "border border-emerald-200 bg-emerald-50 text-emerald-950" : "border border-amber-200 bg-amber-50 text-amber-950"}`}>
              <p className="font-semibold">{result.status === "ANSWERED" ? "Câu trả lời có citation" : result.status === "NO_EVIDENCE" ? "Chưa đủ bằng chứng" : result.status === "PROVIDER_NOT_CONFIGURED" ? "AI provider chưa cấu hình" : "Chưa thể trả lời"}</p>
              <p className="mt-2 whitespace-pre-line">{result.answer || result.error}</p>
            </div>
            {result.answerId && result.status === "ANSWERED" && (
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-900">Đánh giá câu trả lời</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button key={rating} type="button" onClick={() => void sendFeedback("RATING", { rating })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 shadow-sm hover:border-emerald-600 hover:text-emerald-800">{rating}/5</button>
                  ))}
                  <button type="button" onClick={() => setReportOpen(true)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-900 shadow-sm hover:bg-amber-50">Báo cáo</button>
                </div>
                {feedbackMessage && <p className="mt-3 rounded-lg bg-white px-3 py-2 font-medium text-slate-700">{feedbackMessage}</p>}
              </div>
            )}
            {!!result.citations?.length && (
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Nguồn được truy hồi</h2>
                <ul className="mt-3 space-y-3">
                  {result.citations.map((citation) => <li key={citation.citationId} className="rounded-2xl border border-slate-200 p-4 text-sm"><span className="font-semibold text-emerald-700">[{citation.citationId}]</span> <span className="font-medium text-slate-900">{citation.title}</span><p className="mt-1 text-slate-600">{citation.documentNumber || "Chưa có số hiệu"} · {citation.sourceName}</p>{citation.sourceUrl && <a className="mt-1 inline-block text-emerald-700 hover:underline" href={citation.sourceUrl} target="_blank" rel="noreferrer">Mở nguồn kiểm chứng</a>}</li>)}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
      {reportOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 id="report-title" className="text-lg font-bold text-slate-950">Báo cáo câu trả lời</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Mô tả ngắn nội dung chưa chính xác, thiếu nguồn hoặc chưa phù hợp với nhu cầu của bạn.</p>
            <label htmlFor="report-reason" className="mt-4 block text-sm font-bold text-slate-800">Lý do</label>
            <textarea
              id="report-reason"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-950 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-100"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setReportOpen(false); setReportReason(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Hủy</button>
              <button
                type="button"
                disabled={!reportReason.trim()}
                onClick={() => {
                  void sendFeedback("REPORT", { reason: reportReason.trim() });
                  setReportOpen(false);
                  setReportReason("");
                }}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
