"use client";

import Link from "next/link";
import { useState } from "react";

const navigation = [
  { label: "Trang chủ", href: "/" },
  { label: "Văn bản", href: "/documents" },
  { label: "AI trả lời", href: "/ai" },
  { label: "Quản trị", href: "/admin" },
  { label: "Đăng nhập", href: "/login" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 font-semibold text-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            T
          </div>
          <div>
            <div className="text-lg">ThueRadar</div>
            <div className="text-xs text-slate-500">Legal Tax Intelligence</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/documents"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Tra cứu
          </Link>
          <Link
            href="/ai"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Hỏi AI
          </Link>
        </div>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-xl border border-slate-200 p-2 text-slate-700 sm:hidden"
        >
          <span className="text-lg">{menuOpen ? "×" : "☰"}</span>
        </button>
      </div>
      {menuOpen && (
        <nav className="border-t border-slate-100 px-4 py-3 sm:hidden">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-2 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
