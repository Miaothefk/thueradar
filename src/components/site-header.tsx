"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const navigation = [
  { label: "Trang chủ", href: "/" },
  { label: "Văn bản", href: "/documents" },
  { label: "AI trả lời", href: "/ai" },
];

type Account = { id: string; email: string; role: "USER" | "REVIEWER" | "ADMIN" };

export function SiteHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => response.json())
      .then((body: { user?: Account | null }) => setAccount(body.user || null))
      .catch(() => setAccount(null));
  }, []);

  useEffect(() => {
    function closeAccount(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    document.addEventListener("mousedown", closeAccount);
    return () => document.removeEventListener("mousedown", closeAccount);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setAccount(null);
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  }

  const visibleNavigation = account?.role === "ADMIN"
    ? [...navigation, { label: "Quản trị", href: "/admin" }]
    : account?.role === "REVIEWER"
      ? [...navigation, { label: "Kiểm duyệt", href: "/admin" }]
      : navigation;

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

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          {visibleNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex" ref={accountRef}>
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
          {account ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex max-w-52 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm"
                aria-expanded={accountOpen}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs text-white">
                  {account.email.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{account.role === "ADMIN" ? "Quản trị viên" : account.role === "REVIEWER" ? "Người duyệt" : "Tài khoản"}</span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{account.role}</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900">{account.email}</p>
                  </div>
                  {account.role === "ADMIN" && <Link href="/admin" className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Mở trang quản trị</Link>}
                  <button type="button" onClick={() => void logout()} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50">Đăng xuất</button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50">
              Đăng nhập
            </Link>
          )}
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
          {visibleNavigation.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-2 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {item.label}
            </Link>
          ))}
          {!account && (
            <Link href="/login" onClick={() => setMenuOpen(false)} className="mt-2 block rounded-lg bg-emerald-700 px-3 py-3 text-center text-sm font-bold text-white">
              Đăng nhập
            </Link>
          )}
          {account && (
            <button type="button" onClick={() => void logout()} className="mt-2 w-full rounded-lg border border-red-200 px-3 py-3 text-sm font-bold text-red-700">
              Đăng xuất
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
