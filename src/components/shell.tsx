"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Database, House, ListFilter, Plus, RotateCcw, Search, X } from "lucide-react";
import { ROLES, roleLabel, type RoleKey } from "@/lib/types";
import { api, ApiError, DATA_EVENT } from "@/lib/local-api";
import { STORAGE_KEY } from "@/lib/db";
import type { Dashboard } from "@/lib/store";
import { cn } from "./ui";

export { api, ApiError };

/* ---------- simulated role ---------- */

const RoleCtx = React.createContext<{ role: RoleKey; setRole: (r: RoleKey) => void }>({ role: "partnerships", setRole: () => {} });
export const useRole = () => React.useContext(RoleCtx);

/* ---------- toasts ---------- */

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = React.createContext<(text: string, tone?: "ok" | "error") => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

/* ---------- live refresh: other tabs in this browser share the same store ---------- */

export function useAutoRefresh(load: () => void, paused?: () => boolean) {
  React.useEffect(() => {
    const run = () => {
      if (!document.hidden && !(paused && paused())) load();
    };
    run();
    const t = window.setInterval(run, 4000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) run();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(DATA_EVENT, load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DATA_EVENT, load);
    };
  }, [load, paused]);
}

export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
export const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const oppHref = (id: string, tab?: string) => `/opportunity?id=${id}${tab ? `#${tab}` : ""}`;

export function RoleSelect({ className }: { className?: string }) {
  const { role, setRole } = useRole();
  return (
    <select aria-label="Simulated role" value={role} onChange={(e) => setRole(e.target.value as RoleKey)} className={cn("t-quick h-7 rounded-md border border-line bg-white px-2 pr-6 text-xs font-medium text-ink hover:border-zinc-300 focus:outline-none", className)}>
      {ROLES.map((r) => (
        <option key={r.key} value={r.key}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

function scoreDot(score: number | null) {
  return score === null ? "bg-zinc-300" : score >= 60 ? "bg-emerald-500" : score >= 35 ? "bg-amber-400" : "bg-flame";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname().replace(/\/$/, "") || "/";
  const params = useSearchParams();
  const router = useRouter();
  const [role, setRoleState] = React.useState<RoleKey>("partnerships");
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [dash, setDash] = React.useState<Dashboard | null>(null);
  const [q, setQ] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const saved = window.localStorage.getItem("pilot-role");
    if (saved && ROLES.some((r) => r.key === saved)) setRoleState(saved as RoleKey);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const setRole = React.useCallback((r: RoleKey) => {
    setRoleState(r);
    window.localStorage.setItem("pilot-role", r);
  }, []);
  const toast = React.useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 9000 : 4000);
  }, []);
  const loadDash = React.useCallback(() => {
    api<Dashboard>("/api/dashboard").then(setDash).catch(() => {});
  }, []);
  useAutoRefresh(loadDash);

  const opps = dash?.opportunities ?? [];
  const currentId = path === "/opportunity" ? params.get("id") : null;
  const current = opps.find((o) => o.id === currentId);
  const crumb = path === "/" ? "Overview" : path === "/pipeline" ? "Pipeline Intake" : path === "/demo-guide" ? "Demo Guide" : path === "/opportunities/new" ? "New opportunity" : (current?.name ?? "Opportunity");

  const NAV = [
    { href: "/", label: "Overview", icon: House, count: null as number | null, active: path === "/" },
    { href: "/pipeline", label: "Pipeline Intake", icon: ListFilter, count: dash?.pipelineCount || null, active: path === "/pipeline" },
    { href: "/demo-guide", label: "Demo Guide", icon: BookOpen, count: null, active: path === "/demo-guide" },
    { href: "/opportunities/new", label: "New opportunity", icon: Plus, count: null, active: path === "/opportunities/new" },
  ];
  const pages = NAV.map((n) => ({ label: n.label, href: n.href, kind: "Page" }));
  const results = q.trim() ? [...opps.map((o) => ({ label: o.name, href: oppHref(o.id), kind: o.useCase })), ...pages].filter((r) => `${r.label} ${r.kind}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 7) : [];
  const go = (href: string) => {
    setQ("");
    setSearchOpen(false);
    searchRef.current?.blur();
    router.push(href);
  };

  async function reset() {
    if (!window.confirm("Reset all mock data to its original state? Anything you changed in this browser will be cleared.")) return;
    try {
      await api("/api/demo", {});
      loadDash();
      toast("Mock data reset.");
      router.push("/");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <RoleCtx.Provider value={{ role, setRole }}>
      <ToastCtx.Provider value={toast}>
        <div className="flex min-h-screen bg-white">
          <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-canvas md:flex">
            <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
              <span className="grid size-6 place-items-center rounded-md bg-ink text-[11px] font-bold text-white">C</span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-semibold text-ink">Cosmos Pilot Engine</span>
              </span>
            </div>
            <div className="relative px-2.5">
              <Search className="pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) go(results[0].href);
                  if (e.key === "Escape") go(path === "/opportunity" && currentId ? oppHref(currentId) : path);
                }}
                aria-label="Search opportunities and pages"
                placeholder="Search"
                className="t-quick h-7 w-full rounded-md border border-transparent bg-transparent pr-9 pl-7 text-xs text-ink placeholder:text-muted hover:bg-white focus:border-line focus:bg-white focus:outline-none"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded border border-line bg-white px-1 font-sans text-[10px] text-muted">⌘K</kbd>
              {searchOpen && q.trim() && (
                <div className="absolute top-8 right-2.5 left-2.5 z-30 overflow-hidden rounded-md border border-line bg-white shadow-lg">
                  {results.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted">No matches for &ldquo;{q}&rdquo;.</p>
                  ) : (
                    results.map((r, i) => (
                      <button key={r.href} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(r.href)} className={cn("block w-full px-3 py-1.5 text-left hover:bg-canvas", i === 0 && "bg-canvas")}>
                        <span className="block truncate text-xs font-medium text-ink">{r.label}</span>
                        <span className="block truncate text-[11px] text-muted">{r.kind}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <nav className="mt-1.5 space-y-px px-2.5">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={n.active ? "page" : undefined} className={cn("t-quick flex h-7 items-center gap-2 rounded-md border px-2 text-xs", n.active ? "border-line bg-white font-medium text-ink shadow-[0_1px_1px_rgba(0,0,0,0.03)]" : "border-transparent text-zinc-700 hover:bg-white/70")}>
                  <n.icon className="size-3.5 text-muted" />
                  <span className="flex-1">{n.label}</span>
                  {n.count ? <span className="tnum text-[11px] text-muted">{n.count}</span> : null}
                </Link>
              ))}
            </nav>

            <p className="mt-4 px-4.5 pb-1 text-[11px] text-muted">Opportunities</p>
            <div className="min-h-0 flex-1 space-y-px overflow-y-auto px-2.5">
              {opps.map((o) => (
                <Link key={o.id} href={oppHref(o.id)} title={o.name} className={cn("t-quick flex h-7 items-center gap-2 rounded-md border px-2 text-xs", o.id === currentId ? "border-line bg-white font-medium text-ink" : "border-transparent text-zinc-700 hover:bg-white/70")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", scoreDot(o.score))} />
                  <span className="min-w-0 flex-1 truncate">{o.name.replace(" (FICTIONAL)", "")}</span>
                  <span className="tnum text-[11px] text-muted">{o.score === null ? "—" : `${o.score}%`}</span>
                </Link>
              ))}
              {dash && opps.length === 0 && <p className="px-2 py-1 text-[11px] text-muted">None yet.</p>}
            </div>

            <div className="border-t border-line px-3.5 py-3">
              <p className="mb-1 text-[11px] text-muted">Acting as (simulated)</p>
              <RoleSelect className="w-full" />
              <p className="mt-1.5 text-[10.5px] leading-4 text-muted">Demo role switcher. Not sign-in or access control.</p>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex h-11 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur md:px-6">
              <div className="flex min-w-0 items-center gap-1.5 text-xs">
                <Link href="/" className="flex shrink-0 items-center gap-1.5 text-muted hover:text-ink">
                  <House className="size-3.5" />
                  <span className="hidden sm:inline">Cosmos Labs</span>
                </Link>
                <span className="text-zinc-300">/</span>
                <span className="truncate font-medium text-ink">{crumb}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-md bg-lime px-2 py-1 text-[11px] font-medium text-ink sm:inline-flex" title="Every institution, person and number in this app is invented. Nothing is sent to a server.">
                  <Database className="size-3" />
                  Mock data
                </span>
                <nav className="flex items-center gap-2 md:hidden">
                  <Link href="/pipeline" className="text-xs text-muted">
                    Pipeline
                  </Link>
                  <Link href="/demo-guide" className="text-xs text-muted">
                    Guide
                  </Link>
                </nav>
                <RoleSelect className="md:hidden" />
                <button type="button" onClick={reset} className="t-quick inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2 text-xs text-ink hover:bg-canvas">
                  <RotateCcw className="size-3" />
                  <span className="hidden sm:inline">Reset data</span>
                </button>
              </div>
            </header>
            <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-6">{children}</main>
          </div>
        </div>
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={cn("rise pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-[13px] shadow-lg", t.tone === "error" ? "border-red-200 bg-white text-red-800" : "border-navy-700 bg-ink text-white")}>
              <span className="flex-1 leading-5">{t.text}</span>
              <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="mt-0.5 opacity-60 hover:opacity-100">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </RoleCtx.Provider>
  );
}

export const actingAs = (role: RoleKey) => roleLabel(role);
