import { DocumentsList } from "@/components/documents-list";

export default function DocumentsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-emerald-700">Kho văn bản</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Tra cứu pháp luật thuế</h1>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          Dữ liệu thực từ database
        </div>
      </div>
      <DocumentsList />
    </main>
  );
}
