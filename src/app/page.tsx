import Link from "next/link";
import { MinimalDocumentsList } from "@/components/documents-list";
import { getAppConfig } from "@/lib/app-config";

export default function Home() {
  const config = getAppConfig();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="rounded-[28px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-700 px-8 py-10 text-white shadow-xl md:px-12">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-emerald-50/90">
              Thuế Việt Nam • Tra cứu + AI hỗ trợ
            </p>
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              ThueRadar giúp bạn nắm nhanh quy định thuế, văn bản gốc và rủi ro pháp lý.
            </h1>
            <p className="mt-4 max-w-xl text-base text-emerald-50/90 md:text-lg">
              Tra cứu chính xác, theo dõi thay đổi văn bản và nhận câu trả lời từ AI dựa trên nguồn có thể xác minh.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/documents"
                className="rounded-full bg-white px-5 py-3 font-medium text-emerald-700 transition hover:bg-emerald-50"
              >
                Khám phá văn bản
              </Link>
              <Link
                href="/ai"
                className="rounded-full border border-white/40 bg-white/5 px-5 py-3 font-medium text-white transition hover:bg-white/10"
              >
                Hỏi AI hỗ trợ
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-slate-950/20 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-50/80">Trạng thái hệ thống</span>
              <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-xs font-medium text-emerald-50">
                {config.mode === "demo" ? "Demo" : "Đã cấu hình"}
              </span>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-emerald-50/90">
              <li className="flex justify-between gap-3">
                <span>Database</span>
                <span>{config.databaseConfigured ? "OK" : "Thiếu cấu hình"}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>AI provider</span>
                <span>{config.aiConfigured ? "OK" : "Thiếu cấu hình"}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Scheduler</span>
                <span>{config.schedulerConfigured ? "OK" : "Chưa cấu hình"}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        {[
          { label: "Kho văn bản", value: "Chưa kết nối", note: "Cần nguồn pháp lý xác minh" },
          { label: "Tìm kiếm", value: "Sẵn sàng UI", note: "API chưa cấu hình" },
          { label: "AI hỗ trợ", value: "Chờ cấu hình", note: "Chưa phát sinh câu trả lời" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">{item.label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{item.value}</div>
            <div className="mt-2 text-sm text-slate-500">{item.note}</div>
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Văn bản mới nhất</h2>
            <Link href="/documents" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
              Xem tất cả
            </Link>
          </div>
          <MinimalDocumentsList />
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Dòng sự kiện hệ thống</h3>
            <ul className="mt-4 space-y-4 text-sm text-slate-600">
              <li>
                <div className="font-medium text-slate-800">Giao diện đã sẵn sàng</div>
                <div>Nhưng chưa hiển thị bản ghi khi backend chưa kết nối.</div>
              </li>
              <li>
                <div className="font-medium text-slate-800">Chưa có source thật</div>
                <div>Hệ thống yêu cầu cấu hình database, AI provider và scheduler rõ ràng trước khi chạy production.</div>
              </li>
              <li>
                <div className="font-medium text-slate-800">Bản chất an toàn</div>
                <div>Không tự suy đoán hiệu lực pháp lý, chỉ hiển thị bộ trạng thái rõ ràng và cảnh báo.</div>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
            <div className="font-semibold">Lưu ý độ tin cậy pháp lý</div>
            <p className="mt-2">
              Hệ thống chỉ hiển thị nội dung pháp lý sau khi nguồn chính thức được cấu hình và bản ghi được xác minh.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
