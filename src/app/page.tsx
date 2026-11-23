"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, Plus, Scale } from "lucide-react";
import { Button, Card, Segmented, cn } from "@/components/ui";
import { ago, api, oppHref, useAutoRefresh } from "@/components/shell";
import { CRITERIA, ROLES, roleShort, stageLabel } from "@/lib/types";
import type { Dashboard, OppListItem } from "@/lib/store";
import { CountUp, useCountUp } from "@/components/common";

const STAGE_CHIP: Record<string, string> = {
  none: "bg-zinc-100 text-zinc-600 [&>i]:bg-zinc-400",
  discovery: "bg-sky-50 text-sky-800 [&>i]:bg-sky-500",
  needs_validation: "bg-amber-50 text-amber-800 [&>i]:bg-amber-500",
  pilot_scoping: "bg-accent-soft text-accent-strong [&>i]:bg-accent",
  pending_internal_approval: "bg-orange-50 text-orange-800 [&>i]:bg-orange-500",
  ready_for_customer_review: "bg-emerald-50 text-emerald-800 [&>i]:bg-emerald-500",
};
function StageChip({ stage }: { stage: string | null }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", STAGE_CHIP_FOR(stage))}>
      <i className="size-1.5 rounded-full" />
      {stage ? stageLabel(stage) : "Not analyzed"}
    </span>
  );
}
const STAGE_CHIP_FOR = (s: string | null) => STAGE_CHIP[s ?? "none"] ?? STAGE_CHIP.none;

const ROLE_COLOR: Record<string, string> = { partnerships: "#7b6cf0", commercial: "#1a1a1e", product: "#d9f556", engineering: "#ee5f3a", legal: "#38a3d6" };
const SHORT: Record<string, string> = { business_objective: "Objective", sponsor: "Sponsor", budget_owner: "Budget", use_case: "Use case", economics_baseline: "Economics", technical_feasibility: "Technical", kpis: "KPIs", phase_one_scope: "Scope", commercial_terms: "Commercial", legal_process: "Legal" };

function Gauge({ value }: { value: number | null }) {
  // 270° arc, in the spirit of a readiness dial.
  const r = 54;
  const len = 2 * Math.PI * r * 0.75;
  const shown = useCountUp(value ?? 0, 1400);
  const pct = shown / 100;
  return (
    <div className="relative mx-auto h-[132px] w-[148px]">
      <div className="dial-glow pointer-events-none absolute inset-3 rounded-full" aria-hidden />
      <svg viewBox="0 0 140 140" className="relative size-full">
        <defs>
          <linearGradient id="g-arc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ee5f3a" />
            <stop offset="0.5" stopColor="#e8b33c" />
            <stop offset="1" stopColor="#b6d93f" />
          </linearGradient>
        </defs>
        <g transform="rotate(135 70 70)">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#efefeb" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${len} 999`} />
          <circle cx="70" cy="70" r={r} fill="none" stroke="url(#g-arc)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${len * pct} 999`} />
          <circle cx="70" cy="70" r={r - 9} fill="none" stroke="#d9d9d4" strokeWidth="1" strokeDasharray="1 5" />
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center pt-1">
        <div className="text-center">
          <div className="tnum text-[34px] leading-none font-medium tracking-tight text-ink">
            {value === null ? "—" : Math.round(shown)}
            {value !== null && <span className="ml-0.5 text-sm text-muted">/100</span>}
          </div>
          <div className="mt-1 text-[10.5px] text-muted">Avg. completeness</div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, chip, alert }: { label: string; value: number; chip: string; alert?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <CountUp value={value} className="tnum text-[26px] leading-none font-medium tracking-tight text-ink" />
        <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-medium", alert ? "bg-orange-50 text-orange-800" : "bg-emerald-50 text-emerald-800")}>{chip}</span>
      </p>
    </div>
  );
}

function CriteriaChart({ opps }: { opps: OppListItem[] }) {
  const analyzed = opps.filter((o) => o.score !== null);
  const n = Math.max(analyzed.length, 1);
  const rows = CRITERIA.map((c) => {
    const st = analyzed.map((o) => o.criteria.find((x) => x.key === c.key)?.status ?? "missing");
    return { key: c.key, label: c.label, met: st.filter((s) => s === "met").length, partial: st.filter((s) => s === "partial").length, missing: st.filter((s) => s === "missing").length };
  });
  const H = 132;
  return (
    <div className="px-4 pt-1 pb-3">
      <div className="flex">
        <div className="tnum flex w-6 flex-col justify-between pb-5 text-[10px] text-muted" style={{ height: H + 20 }}>
          <span>{n}</span>
          <span>{Math.round(n / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative grid flex-1 grid-cols-10 gap-1 sm:gap-3">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ top: H / 2 }} />
          <div className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: H }} />
          {rows.map((r, i) => (
            <div key={r.key} className="relative flex flex-col items-center" title={`${r.label}: ${r.met} met, ${r.partial} partial, ${r.missing} missing (of ${analyzed.length} analyzed)`}>
              <div className="grow-y flex w-full max-w-[11px] flex-col justify-end gap-[2px]" style={{ height: H, ["--i" as string]: i }}>
                {r.missing > 0 && (
                  <div className="relative rounded-full bg-flame/20" style={{ height: `${(r.missing / n) * 100}%`, minHeight: 9, transition: "height 500ms var(--ease-out)" }}>
                    <span className="absolute inset-x-0 top-0 h-[9px] rounded-full bg-flame" />
                  </div>
                )}
                {r.partial > 0 && <div className="rounded-full bg-accent/40" style={{ height: `${(r.partial / n) * 100}%`, transition: "height 500ms var(--ease-out)" }} />}
                {r.met > 0 && <div className="rounded-full bg-accent" style={{ height: `${(r.met / n) * 100}%`, transition: "height 500ms var(--ease-out)" }} />}
              </div>
              <span className="mt-1.5 w-full truncate text-center text-[10px] text-muted">{SHORT[r.key]}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <i className="size-1.5 rounded-full bg-accent" /> Evidenced
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="size-1.5 rounded-full bg-accent/40" /> Partial
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="size-1.5 rounded-full bg-flame" /> Missing
        </span>
        <span>Ten completeness criteria across {analyzed.length} analyzed opportunit{analyzed.length === 1 ? "y" : "ies"}</span>
      </p>
    </div>
  );
}

const initials = (role: string) => roleShort(role).slice(0, 2).toUpperCase();

export default function DashboardPage() {
  const [d, setD] = React.useState<Dashboard | null>(null);
  const [filter, setFilter] = React.useState<"all" | "attention" | "analyzed">("all");
  const [sort, setSort] = React.useState<"updated" | "readiness" | "blockers">("updated");
  const router = useRouter();
  const load = React.useCallback(() => {
    api<Dashboard>("/api/dashboard").then(setD).catch(() => {});
  }, []);
  useAutoRefresh(load);

  if (!d)
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-64" />
        <div className="skeleton h-48" />
      </div>
    );

  const c = d.cards;
  const attention = d.opportunities.filter((o) => o.openHigh > 0 || o.openDisagreements > 0).length;
  const rows = d.opportunities
    .filter((o) => (filter === "analyzed" ? o.score !== null : filter === "attention" ? o.openHigh > 0 || o.openDisagreements > 0 : true))
    .sort((a, b) => (sort === "readiness" ? (b.score ?? -1) - (a.score ?? -1) : sort === "blockers" ? b.openHigh - a.openHigh || b.openBlockers - a.openBlockers : a.updatedAt < b.updatedAt ? 1 : -1));
  const firstDis = d.opportunities.find((o) => o.openDisagreements > 0);
  const totalOpen = d.blockersByOwner.reduce((n, r) => n + r.open, 0);

  return (
    <div className="stagger space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Overview</h1>
          <p className="mt-0.5 text-xs text-muted">
            {c.opportunities} opportunities · {c.analyzed} analyzed · {attention} need attention
          </p>
        </div>
        <Link href="/opportunities/new">
          <Button variant="primary">
            <Plus className="size-3.5" />
            New opportunity
          </Button>
        </Link>
      </div>

      <Card className="sweep grid lg:grid-cols-[250px_minmax(0,1fr)]" style={{ ["--i" as string]: 1 }}>
        <div className="border-b border-line px-4 py-3.5 lg:border-r lg:border-b-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-ink">Pilot readiness</h2>
            <span className="inline-flex items-center gap-1 rounded bg-lime px-1.5 py-0.5 text-[10.5px] font-medium text-ink">
              <i className="live-dot size-1.5 rounded-full bg-ink text-ink" />
              Mock
            </span>
          </div>
          <p className="text-[11px] text-muted">Share of ten criteria with evidence</p>
          <Gauge value={c.avgScore} />
          <p className="-mt-3 text-center">
            <span className="rounded bg-lime px-1.5 py-0.5 text-[10.5px] font-medium text-ink">
              {c.analyzed} of {c.opportunities} analyzed
            </span>
          </p>
          <p className="mt-2.5 text-center text-[11px] leading-4 text-muted">
            People have recorded {d.value.decisionsRecorded} decision{d.value.decisionsRecorded === 1 ? "" : "s"}; {c.openDisagreements} disagreement{c.openDisagreements === 1 ? " is" : "s are"} waiting for one.
          </p>
          {firstDis && (
            <p className="mt-1 text-center">
              <Link href={oppHref(firstDis.id, "readiness")} className="text-[11px] font-medium text-ink underline underline-offset-2 hover:text-accent-strong">
                Review open disagreements
              </Link>
            </p>
          )}
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
            <Kpi label="Opportunities" value={c.opportunities} chip={`${c.analyzed} analyzed`} />
            <Kpi label="Open high-priority blockers" value={c.openHighBlockers} chip={`${totalOpen} open in total`} alert={c.openHighBlockers > 0} />
            <Kpi label="Pending approvals" value={c.pendingReviews + c.openDisagreements} chip={`${c.pendingReviews} review${c.pendingReviews === 1 ? "" : "s"} · ${c.openDisagreements} decision${c.openDisagreements === 1 ? "" : "s"}`} alert={c.openDisagreements > 0} />
            <Kpi label="Packages drafted" value={c.briefs + c.mous} chip={`${c.briefs} brief${c.briefs === 1 ? "" : "s"} · ${c.mous} agreement${c.mous === 1 ? "" : "s"}`} />
          </div>
          <CriteriaChart opps={d.opportunities} />
        </div>
      </Card>

      <section style={{ ["--i" as string]: 2 }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            Opportunities <span className="tnum rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-normal text-muted">{rows.length} shown</span>
          </h2>
          <div className="flex items-center gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "attention", label: "Needs attention" },
                { value: "analyzed", label: "Analyzed" },
              ]}
            />
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="t-quick h-7 rounded-md border border-line bg-white px-2 pr-6 text-xs text-ink hover:border-zinc-300 focus:outline-none">
              <option value="updated">Sort: Updated</option>
              <option value="readiness">Sort: Readiness</option>
              <option value="blockers">Sort: Blockers</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="bg-canvas text-left text-[11px] text-muted">
                {["Institution", "Status", "Use case", "Owner", "Readiness", "Blockers", "Decisions", "Package", "Updated"].map((h, i) => (
                  <th key={h} className={cn("border-b border-line px-3 py-2 font-medium", i > 0 && "border-l")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted">
                    No opportunities match this filter.
                  </td>
                </tr>
              )}
              {rows.map((o, i) => (
                <tr key={o.id} onClick={() => router.push(oppHref(o.id))} style={{ ["--i" as string]: i }} className="row-in t-quick cursor-pointer border-b border-line last:border-0 hover:bg-canvas/70">
                  <td className="px-3 py-2">
                    <Link href={oppHref(o.id)} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 font-medium text-ink hover:text-accent-strong">
                      <span className="grid size-5 shrink-0 place-items-center rounded bg-accent-soft text-[10px] font-semibold text-accent-strong">{o.name[0]}</span>
                      {o.name.replace(" (FICTIONAL)", "")}
                    </Link>
                  </td>
                  <td className="border-l border-line px-3 py-2">
                    <StageChip stage={o.readinessStage} />
                  </td>
                  <td className="border-l border-line px-3 py-2 text-zinc-700">{o.useCase}</td>
                  <td className="border-l border-line px-3 py-2">
                    <span className="flex items-center gap-1.5 text-zinc-700">
                      <span className="grid size-4.5 place-items-center rounded-full bg-ink text-[8.5px] font-semibold text-white">{initials(o.ownerRole)}</span>
                      {roleShort(o.ownerRole)}
                    </span>
                  </td>
                  <td className="border-l border-line px-3 py-2">
                    {o.score === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="tnum w-7 text-ink">{o.score}%</span>
                        <span className="h-1 w-14 overflow-hidden rounded-full bg-zinc-100">
                          <span className={cn("grow-x block h-full rounded-full", o.score < 35 ? "bg-flame" : "bg-accent")} style={{ width: `${o.score}%`, ["--i" as string]: i }} />
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="tnum border-l border-line px-3 py-2">{o.score === null ? <span className="text-muted">—</span> : <span>{o.openBlockers}{o.openHigh > 0 && <span className="ml-1.5 rounded bg-red-50 px-1 py-0.5 text-[10.5px] font-medium text-red-700">{o.openHigh} high</span>}</span>}</td>
                  <td className="border-l border-line px-3 py-2">{o.score === null ? <span className="text-muted">—</span> : o.openDisagreements > 0 ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800">{o.openDisagreements} open</span> : <span className="text-zinc-700">None open</span>}</td>
                  <td className="border-l border-line px-3 py-2">
                    <span className="flex items-center gap-1">
                      {o.hasBrief && (
                        <span className="inline-flex items-center gap-1 rounded border border-line px-1 py-0.5 text-[10.5px] text-zinc-700">
                          <FileText className="size-3" /> Brief
                        </span>
                      )}
                      {o.hasMou && (
                        <span className="inline-flex items-center gap-1 rounded border border-line px-1 py-0.5 text-[10.5px] text-zinc-700">
                          <Scale className="size-3" /> MOU
                        </span>
                      )}
                      {!o.hasBrief && !o.hasMou && <span className="text-muted">—</span>}
                    </span>
                  </td>
                  <td className="border-l border-line px-3 py-2 text-muted">{ago(o.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="stagger grid gap-4 lg:grid-cols-3" style={{ animation: "none" }}>
        <Card style={{ ["--i" as string]: 4 }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <h2 className="text-[13px] font-semibold text-ink">Recent activity</h2>
            <span className="text-[11px] text-muted">From the audit trail</span>
          </div>
          <ul className="divide-y divide-line px-4 pb-2">
            {d.activity.map((a) => (
              <li key={a.id}>
                <Link href={oppHref(a.opportunityId, "review")} className="group flex items-start gap-2 py-2">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <Check className="size-2.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink group-hover:text-accent-strong">
                      {a.action} <span className="font-normal text-muted">· {a.actor}</span>
                    </span>
                    <span className="block truncate text-[11px] text-muted">{a.opportunityName.replace(" (FICTIONAL)", "")}</span>
                  </span>
                  <span className="tnum shrink-0 text-[11px] text-muted">{ago(a.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card style={{ ["--i" as string]: 5 }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <h2 className="text-[13px] font-semibold text-ink">Open blockers by owner</h2>
            <span className="text-[11px] text-muted">Who is on the hook</span>
          </div>
          <div className="px-4 pb-3">
            <p className="tnum text-[22px] leading-none font-medium tracking-tight text-ink">
              <CountUp value={totalOpen} /> <span className="text-xs font-normal text-muted">open · {c.openHighBlockers} high priority</span>
            </p>
            <div className="grow-x mt-2.5 flex h-1.5 gap-px overflow-hidden rounded-full bg-zinc-100" style={{ ["--i" as string]: 6 }}>
              {d.blockersByOwner.filter((r) => r.open > 0).map((r) => (
                <span key={r.role} style={{ width: `${(r.open / Math.max(totalOpen, 1)) * 100}%`, background: ROLE_COLOR[r.role] }} title={`${roleShort(r.role)}: ${r.open}`} />
              ))}
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {d.blockersByOwner.map((r) => (
                <li key={r.role} className="flex items-center gap-2 text-xs">
                  <i className="size-2 rounded-sm" style={{ background: ROLE_COLOR[r.role], outline: r.role === "product" ? "1px solid #c5de4c" : undefined }} />
                  <span className="flex-1 text-zinc-700">{ROLES.find((x) => x.key === r.role)?.label}</span>
                  {r.high > 0 && <span className="rounded bg-red-50 px-1 py-0.5 text-[10.5px] font-medium text-red-700">{r.high} high</span>}
                  <span className="tnum w-5 text-right text-ink">{r.open}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card style={{ ["--i" as string]: 6 }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <h2 className="text-[13px] font-semibold text-ink">Knowledge sources</h2>
            <span className="text-[11px] text-muted">What a claim may rest on</span>
          </div>
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {d.knowledge.map((k) => (
                <span key={k.path} className="inline-flex items-center gap-1.5 rounded border border-line px-1.5 py-1 text-[11px] text-zinc-700" title={k.tier === "approved" ? "Approved" : k.tier === "demo_only" ? "Illustrative only" : "Not approved"}>
                  <i className={cn("size-1.5 rounded-full", k.tier === "approved" ? "bg-emerald-500" : k.tier === "demo_only" ? "bg-accent" : "bg-amber-400")} />
                  {k.name.replace(/\.md$/, "")}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-4 text-muted">
              <span className="font-medium text-ink">{d.knowledge.filter((k) => k.tier === "approved").length} of {d.knowledge.length} approved.</span> Until a reference is approved, every capability and commercial term is flagged unverified or [TO CONFIRM].
            </p>
            <dl className="mt-2.5 grid grid-cols-3 gap-2 border-t border-line pt-2.5">
              {[
                ["Blockers surfaced", d.value.blockersSurfaced],
                ["Finding reviews", d.value.findingReviews],
                ["Analysis runs", d.value.analysisRuns],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] text-muted">{k}</dt>
                  <dd className="tnum text-base font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </div>
      <p className="text-center text-[11px] text-muted">Every institution, person and figure here is invented. Data is stored only in this browser.</p>
    </div>
  );
}
