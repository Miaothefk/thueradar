"use client";

import { FormEvent, useState } from "react";

type Citation = { citationId: string; title: string; documentNumber: string | null; sourceName: string; sourceUrl: string | null };
type AnswerResult = { status: string; answer?: string; citations?: Citation[]; error?: string; errorCode?: string; answerId?: string };

export default function AiPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={ask}>
          <label htmlFor="question" className="text-sm font-semibold text-slate-700">Câu hỏi pháp lý</label>
          <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ví dụ: Quy định nào trong các văn bản đã lưu liên quan đến…?" className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-emerald-500 focus:bg-white" />
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">AI provider chạy phía server; API key không được gửi xuống trình duyệt.</p>
            <button type="submit" disabled={loading || !question.trim()} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{loading ? "Đang kiểm tra…" : "Gửi câu hỏi"}</button>
          </div>
        </form>
        {result && (
          <div className="mt-6 space-y-5">
            <div className={`rounded-2xl p-5 text-sm leading-6 ${result.status === "ANSWERED" ? "border border-emerald-200 bg-emerald-50 text-emerald-950" : "border border-amber-200 bg-amber-50 text-amber-950"}`}>
              <p className="font-semibold">{result.status === "ANSWERED" ? "Câu trả lời có citation" : result.status === "NO_EVIDENCE" ? "Chưa đủ bằng chứng" : result.status === "PROVIDER_NOT_CONFIGURED" ? "AI provider chưa cấu hình" : "Chưa thể trả lời"}</p>
              <p className="mt-2 whitespace-pre-line">{result.answer || result.error}</p>
            </div>
            {result.answerId && result.status === "ANSWERED" && <div className="rounded-2xl border border-slate-200 p-4 text-sm"><p className="font-semibold text-slate-800">Đánh giá câu trả lời</p><div className="mt-3 flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} onClick={() => void sendFeedback("RATING", { rating })} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-emerald-500">{rating}/5</button>)}<button onClick={() => { const reason = window.prompt("Lý do báo cáo câu trả lời?"); if (reason) void sendFeedback("REPORT", { reason }); }} className="rounded-lg border border-amber-200 px-3 py-1.5 text-amber-800 hover:bg-amber-50">Báo cáo</button></div>{feedbackMessage && <p className="mt-2 text-slate-600">{feedbackMessage}</p>}</div>}
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
    </main>
  );
}
