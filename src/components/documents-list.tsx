"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DocumentSummary = {
  id: string;
  title: string;
  documentNumber: string | null;
  documentType: string | null;
  issuingAuthority: string | null;
  taxTopic: string | null;
  summary: string | null;
  status: string;
  effectiveAt: string | null;
  source: { name: string; url: string | null; isOfficial: boolean } | null;
};

type SearchResponse = {
  documents: DocumentSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  error?: string;
};

const topicOptions = ["VAT", "Thuế thu nhập cá nhân", "Hóa đơn điện tử", "Thuế doanh nghiệp"];
const typeOptions = ["Nghị định", "Thông tư", "Quyết định", "Công văn"];

export function DocumentsList() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (query.trim()) params.set("q", query.trim());
    if (topic) params.set("taxTopic", topic);
    if (type) params.set("documentType", type);
    fetch(`/api/documents?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Không thể tải dữ liệu.");
        return body as SearchResponse;
      })
      .then(setResult)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ documents: [], pagination: { page, pageSize: 12, total: 0, totalPages: 0 }, error: error instanceof Error ? error.message : "Không thể tải dữ liệu." });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, query, topic, type]);

  const resetPage = () => setPage(1);
  const documents = result?.documents ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Từ khóa
            <input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Số hiệu, tiêu đề hoặc từ khóa" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Nhóm thuế
            <select value={topic} onChange={(event) => { setTopic(event.target.value); resetPage(); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white">
              <option value="">Tất cả</option>
              {topicOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Loại văn bản
            <select value={type} onChange={(event) => { setType(event.target.value); resetPage(); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white">
              <option value="">Tất cả</option>
              {typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>{loading ? "Đang tải từ cơ sở dữ liệu…" : `${result?.pagination.total ?? 0} văn bản từ cơ sở dữ liệu`}</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Nguồn: database</span>
      </div>

      {result?.error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">{result.error}</div>
      ) : documents.length === 0 && !loading ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center md:px-10">
          <h2 className="text-xl font-bold text-slate-900">Chưa có văn bản phù hợp</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Kho văn bản chỉ hiển thị dữ liệu thực từ database. Hãy thử thay đổi bộ lọc hoặc cấu hình nguồn pháp lý đã xác minh.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {documents.map((document) => (
            <Link key={document.id} href={`/documents/${document.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{document.documentType || "Văn bản"}{document.documentNumber ? ` · ${document.documentNumber}` : ""}</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{document.title}</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">{document.status === "VERIFIED" ? "Đã xác minh" : document.status}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{document.summary || "Chưa có tóm tắt được xác minh."}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>{document.taxTopic || "Chưa phân nhóm"}</span>
                <span>{document.issuingAuthority || "Chưa có cơ quan ban hành"}</span>
                <span>{document.effectiveAt ? `Hiệu lực: ${new Date(document.effectiveAt).toLocaleDateString("vi-VN")}` : "Chưa có ngày hiệu lực"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {result && result.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Trước</button>
          <span>Trang {page} / {result.pagination.totalPages}</span>
          <button disabled={page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Sau</button>
        </div>
      )}
    </div>
  );
}

export function MinimalDocumentsList() {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6"><p className="text-sm leading-6 text-slate-600">Chưa có dữ liệu pháp lý được xác minh. Kết nối nguồn chính thức để hiển thị các cập nhật mới nhất.</p></div>;
}
