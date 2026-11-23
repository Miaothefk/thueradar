"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DocumentDetail = {
  id: string;
  title: string;
  content: string | null;
  documentNumber: string | null;
  documentType: string | null;
  issuingAuthority: string | null;
  taxTopic: string | null;
  summary: string | null;
  changeSummary: string | null;
  highlights: string[];
  replacedDocumentNumber: string | null;
  replacementDocumentNumber: string | null;
  legalStatus: string;
  keywords: string[];
  status: string;
  effectiveAt: string | null;
  updatedAt: string;
  source: { name: string; url: string | null; isOfficial: boolean } | null;
  versions: { id: string; version: number; createdAt: string }[];
};

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  useEffect(() => {
    params.then(({ id }) => fetch(`/api/documents/${id}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Không thể tải văn bản.");
      return body.document as DocumentDetail;
    }).then((loaded) => {
      setDocument(loaded);
      void Promise.all([
        fetch(`/api/documents/${loaded.id}/save`).then((response) => response.json()).then((body: { saved?: boolean }) => setSaved(Boolean(body.saved))),
        loaded.taxTopic ? fetch(`/api/topics/${encodeURIComponent(loaded.taxTopic)}/follow`).then((response) => response.json()).then((body: { following?: boolean }) => setFollowing(Boolean(body.following))) : Promise.resolve(),
      ]);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải văn bản.")));
  }, [params]);

  async function saveDocument() {
    if (!document) return;
    setSaveMessage(null);
    const response = await fetch(`/api/documents/${document.id}/save`, { method: saved ? "DELETE" : "POST" });
    const body = await response.json();
    if (response.ok) setSaved(Boolean(body.saved));
    setSaveMessage(response.ok ? (body.saved ? "Đã lưu văn bản vào tài khoản." : "Đã bỏ lưu văn bản.") : body.error || "Không thể cập nhật trạng thái lưu.");
  }

  async function toggleTopic() {
    if (!document?.taxTopic) return;
    const response = await fetch(`/api/topics/${encodeURIComponent(document.taxTopic)}/follow`, { method: following ? "DELETE" : "POST" });
    const body = await response.json();
    if (response.ok) setFollowing(Boolean(body.following));
    else setSaveMessage(body.error || "Không thể cập nhật theo dõi chủ đề.");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Link href="/documents" className="font-medium text-emerald-700 hover:text-emerald-800">← Quay lại danh sách</Link>
        {document && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{document.status === "VERIFIED" ? "Đã xác minh" : document.status}</span>}
      </div>
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">{error}</div>
      ) : !document ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">Đang tải văn bản từ database…</div>
      ) : (
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">{document.documentType || "Văn bản pháp luật"}{document.documentNumber ? ` · ${document.documentNumber}` : ""}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{document.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={saveDocument} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{saved ? "Bỏ lưu văn bản" : "Lưu văn bản"}</button>
            {document.taxTopic && <button onClick={toggleTopic} className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">{following ? "Bỏ theo dõi chủ đề" : `Theo dõi ${document.taxTopic}`}</button>}
            {saveMessage && <span className="text-sm text-slate-600">{saveMessage}</span>}
          </div>
          <dl className="mt-6 grid gap-4 text-sm text-slate-600 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-slate-400">Cơ quan</dt><dd className="mt-1 font-medium text-slate-800">{document.issuingAuthority || "Chưa có"}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-slate-400">Nhóm thuế</dt><dd className="mt-1 font-medium text-slate-800">{document.taxTopic || "Chưa có"}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-slate-400">Hiệu lực</dt><dd className="mt-1 font-medium text-slate-800">{document.effectiveAt ? new Date(document.effectiveAt).toLocaleDateString("vi-VN") : "Chưa có"}</dd></div>
          </dl>
          <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Tóm tắt</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">Hiệu lực: {document.legalStatus}</span>
            </div>
            <p className="mt-3 leading-7 text-slate-800">{document.summary || "Chưa có tóm tắt được AI xác minh."}</p>
          </section>
          <section className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">Thay đổi so với quy định trước</h2>
              <p className="mt-3 leading-7 text-slate-700">{document.changeSummary || "Chưa xác định được thay đổi so với văn bản trước."}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">Điểm nổi bật</h2>
              {document.highlights.length ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {document.highlights.map((highlight) => <li key={highlight} className="flex gap-2"><span className="text-emerald-700">•</span><span>{highlight}</span></li>)}
                </ul>
              ) : <p className="mt-3 text-sm text-slate-500">Chưa có điểm nổi bật được xác định.</p>}
            </div>
          </section>
          <section className="mt-8"><h2 className="text-lg font-semibold text-slate-900">Nội dung văn bản</h2><div className="mt-3 whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-700">{document.content || "Nội dung chưa được tải."}</div></section>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-semibold text-slate-900">Từ khóa</h3><div className="mt-3 flex flex-wrap gap-2">{document.keywords.length ? document.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{keyword}</span>) : <span className="text-sm text-slate-500">Chưa có từ khóa.</span>}</div></section>
            <section className="rounded-2xl border border-slate-200 p-5"><h3 className="text-lg font-semibold text-slate-900">Nguồn tham chiếu</h3><p className="mt-3 text-sm text-slate-700">{document.source?.name || "Chưa có nguồn"}</p>{document.source?.url && <a href={document.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-emerald-700 hover:underline">Mở nguồn chính thức</a>}</section>
          </div>
          <section className="mt-8 rounded-2xl border border-slate-200 p-5"><h2 className="text-lg font-semibold text-slate-900">Lịch sử phiên bản</h2><p className="mt-3 text-sm text-slate-600">{document.versions.length ? document.versions.map((version) => `Phiên bản ${version.version} · ${new Date(version.createdAt).toLocaleDateString("vi-VN")}`).join("  •  ") : "Chưa có lịch sử phiên bản."}</p></section>
        </article>
      )}
    </main>
  );
}
