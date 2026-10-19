"use client";

import { useEffect, useState } from "react";

type Notification = { id: string; title: string; message: string; link: string | null; status: string; createdAt: string };

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/notifications").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Không thể tải thông báo.");
      setItems(body.notifications as Notification[]);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải thông báo."));
  }, []);
  async function markRead(id: string) {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, status: "READ" } : item));
  }
  return <main className="mx-auto max-w-3xl px-6 py-10"><h1 className="text-3xl font-bold text-slate-900">Thông báo</h1>{error ? <p className="mt-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">{error}</p> : <div className="mt-6 space-y-3">{items.length ? items.map((item) => <article key={item.id} className={`rounded-2xl border p-4 ${item.status === "UNREAD" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="flex justify-between gap-3"><h2 className="font-semibold text-slate-900">{item.title}</h2>{item.status === "UNREAD" && <button onClick={() => void markRead(item.id)} className="text-xs text-emerald-800 hover:underline">Đánh dấu đã đọc</button>}</div><p className="mt-2 text-sm text-slate-700">{item.message}</p>{item.link && <a href={item.link} className="mt-2 inline-block text-sm text-emerald-700 hover:underline">Mở văn bản</a>}</article>) : <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chưa có thông báo.</p>}</div>}</main>;
}
