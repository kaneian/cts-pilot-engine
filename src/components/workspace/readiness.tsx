"use client";

import * as React from "react";
import { ArrowRight, Check, ChevronDown, Minus, Pencil, X } from "lucide-react";
import { Badge, Banner, Button, Card, CardHeader, Empty, EvidenceList, Input, Label, Select, Textarea, cn, type Tone } from "@/components/ui";
import { fmtTime, useRole } from "@/components/shell";
import { useCountUp, useWorkspace } from "@/components/common";
import { CRITERIA, ROLES, criterionLabel, roleLabel, roleShort, stageLabel, type Blocker, type Disagreement, type Finding } from "@/lib/types";

const PRIORITY: Record<string, Tone> = { high: "red", medium: "amber", low: "neutral" };
const STATE: Record<string, Tone> = { open: "neutral", in_review: "teal", resolved: "green", deferred: "neutral" };

function ScoreDial({ score }: { score: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const shown = useCountUp(score, 1000);
  return (
    <div className="relative size-[112px] shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#efefeb" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="tnum text-3xl leading-none font-semibold text-ink">{Math.round(shown)}</div>
          <div className="mt-1 text-[10px] font-medium tracking-wide text-muted uppercase">of 100</div>
        </div>
      </div>
    </div>
  );
}

function BlockerCard({ b }: { b: Blocker }) {
  const { act } = useWorkspace();
  const [edit, setEdit] = React.useState(false);
  const [open, setOpen] = React.useState(b.priority === "high");
  const [f, setF] = React.useState({ ownerRole: b.ownerRole, recommendedAction: b.recommendedAction, deadline: b.deadline ?? "", priority: b.priority, state: b.state });
  const [base, setBase] = React.useState(b.lastEditedAt ?? "");
  const [saving, setSaving] = React.useState(false);
  const start = () => {
    setF({ ownerRole: b.ownerRole, recommendedAction: b.recommendedAction, deadline: b.deadline ?? "", priority: b.priority, state: b.state });
    setBase(b.lastEditedAt ?? "");
    setEdit(true);
    setOpen(true);
  };
  return (
    <div className={cn("rounded-lg border bg-white", b.state === "resolved" ? "border-line opacity-70" : b.priority === "high" ? "border-red-200" : "border-line")}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button type="button" aria-label={open ? "Collapse" : "Expand"} aria-expanded={open} onClick={() => setOpen(!open)} className="mt-0.5 text-muted hover:text-ink">
          <ChevronDown className={cn("size-4 transition-transform duration-150", !open && "-rotate-90")} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className={cn("text-sm font-semibold text-ink", b.state === "resolved" && "line-through decoration-zinc-400")}>{b.title}</h3>
            <Badge tone={PRIORITY[b.priority]}>{b.priority}</Badge>
            <Badge tone={STATE[b.state]}>{b.state.replace("_", " ")}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Owner: <span className="font-medium text-ink">{roleLabel(b.ownerRole)}</span>
            {" · "}Deadline: <span className={cn("font-medium", b.deadline ? "text-ink" : "text-amber-700")}>{b.deadline || "not set"}</span>
            {b.lastEditedBy && <> · last edited by {b.lastEditedBy}</>}
          </p>
        </div>
        {!edit && (
          <Button size="sm" variant="ghost" onClick={start}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}
      </div>
      {open && !edit && (
        <div className="grid gap-4 border-t border-line px-4 py-3 pl-11 text-sm md:grid-cols-2">
          <div className="space-y-2.5">
            <div>
              <p className="text-xs font-medium text-muted">Why it matters</p>
              <p className="mt-0.5 leading-6">{b.whyItMatters}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Next action</p>
              <p className="mt-0.5 leading-6">{b.recommendedAction}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Open question</p>
              <p className="mt-0.5 leading-6">{b.openQuestion}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Evidence</p>
            <EvidenceList items={b.evidence} />
          </div>
        </div>
      )}
      {edit && (
        <form
          className="grid gap-3 border-t border-line bg-zinc-50/60 px-4 py-3 pl-11 md:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            if (await act({ type: "updateBlocker", blockerId: b.id, baseEditedAt: base, patch: f }, "Blocker updated.")) setEdit(false);
            setSaving(false);
          }}
        >
          <div>
            <Label>Owner</Label>
            <Select value={f.ownerRole} onChange={(e) => setF({ ...f, ownerRole: e.target.value as Blocker["ownerRole"] })}>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Blocker["priority"] })}>
              {["high", "medium", "low"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>State</Label>
            <Select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value as Blocker["state"] })}>
              {["open", "in_review", "resolved", "deferred"].map((p) => (
                <option key={p} value={p}>
                  {p.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Deadline</Label>
            <Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <Label>Next action</Label>
            <Textarea rows={2} value={f.recommendedAction} onChange={(e) => setF({ ...f, recommendedAction: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 md:col-span-4">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={saving}>
              Save blocker
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function DisagreementCard({ d }: { d: Disagreement }) {
  const { act } = useWorkspace();
  const { role } = useRole();
  const me = roleLabel(role);
  const options = React.useMemo(() => [{ label: "Proposed resolution", text: d.proposedResolution }, ...d.positions.map((p) => ({ label: p.reviewer.replace(" reviewer", ""), text: p.position }))].filter((o) => o.text), [d]);
  const [choice, setChoice] = React.useState(0);
  const [adopted, setAdopted] = React.useState(options[0]?.text ?? "");
  const [rationale, setRationale] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reopen, setReopen] = React.useState<string | null>(null);
  const res = d.resolution;

  return (
    <div className={cn("rounded-lg border bg-white", res ? "border-emerald-200" : "border-amber-300")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">{d.topic}</h3>
        <span className="flex gap-1.5">
          {d.criterion && <Badge>{criterionLabel(d.criterion)}</Badge>}
          <Badge tone={res ? "green" : "amber"}>{res ? "Resolved by a human" : "Needs a human decision"}</Badge>
        </span>
      </div>
      <div className="grid gap-px bg-line md:grid-cols-3">
        {d.positions.map((p, i) => (
          <div key={i} className="bg-white px-4 py-3">
            <p className="text-xs font-semibold text-navy-700">{p.reviewer}</p>
            <p className="mt-1 text-sm leading-6 text-ink">{p.position}</p>
          </div>
        ))}
      </div>
      {res ? (
        <div className="space-y-3 border-t border-line bg-emerald-50/50 px-4 py-3">
          <div>
            <p className="text-xs font-medium text-emerald-800">
              Decision by {res.by} · {fmtTime(res.at)}
            </p>
            <p className="mt-1 text-sm leading-6 font-medium text-ink">{res.adopted}</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              <span className="font-medium text-ink">Rationale:</span> {res.rationale}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(res.approvals ?? []).map((a) => (
              <Badge key={a.by} tone="green">
                <Check className="size-3" />
                Approved by {a.by}
              </Badge>
            ))}
            {res.by !== me && !(res.approvals ?? []).some((a) => a.by === me) && (
              <Button size="sm" variant="primary" onClick={() => act({ type: "endorseResolution", disagreementId: d.id }, "Approval recorded.")}>
                <Check className="size-3.5" />
                Approve as {me}
              </Button>
            )}
            {res.by === me && !(res.approvals ?? []).length && <span className="text-xs text-muted">Switch role to record another team&rsquo;s approval.</span>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setReopen(reopen === null ? "" : null)}>
              Reopen
            </Button>
          </div>
          {reopen !== null && (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act({ type: "reopenDisagreement", disagreementId: d.id, rationale: reopen }, "Disagreement reopened.")) setReopen(null);
              }}
            >
              <Input aria-label="Reason for reopening" value={reopen} onChange={(e) => setReopen(e.target.value)} placeholder="Why should this decision be reopened?" />
              <Button type="submit" variant="danger" disabled={reopen.trim().length < 5}>
                Reopen as {me}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <form
          className="space-y-3 border-t border-line bg-amber-50/40 px-4 py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await act({ type: "resolveDisagreement", disagreementId: d.id, adopted, rationale }, "Decision recorded. Re-run the analysis to see its effect.");
            setBusy(false);
          }}
        >
          <p className="text-xs text-muted">The reconciler does not pick a winner. Choose a starting point, edit the wording if needed, and give your rationale.</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={choice === i}
                onClick={() => {
                  setChoice(i);
                  setAdopted(o.text);
                }}
                className={cn("t-quick rounded-md border px-2.5 py-1 text-xs font-medium", choice === i ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-muted hover:text-ink")}
              >
                Adopt: {o.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={choice === -1}
              onClick={() => {
                setChoice(-1);
                setAdopted("");
              }}
              className={cn("t-quick rounded-md border px-2.5 py-1 text-xs font-medium", choice === -1 ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-muted hover:text-ink")}
            >
              Write a different decision
            </button>
          </div>
          <div>
            <Label>Decision to adopt</Label>
            <Textarea aria-label="Decision to adopt" rows={2} value={adopted} onChange={(e) => setAdopted(e.target.value)} />
          </div>
          <div>
            <Label>Rationale (required)</Label>
            <Textarea aria-label="Rationale" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why this option? This is recorded in the audit trail." />
          </div>
          <div className="flex items-center justify-end gap-3">
            {(adopted.trim().length < 5 || rationale.trim().length < 5) && <span className="text-xs text-muted">Add a decision and a rationale to continue.</span>}
            <Button type="submit" variant="primary" loading={busy} disabled={adopted.trim().length < 5 || rationale.trim().length < 5}>
              Record decision as {me}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function FindingColumn({ title, hint, tone, items }: { title: string; hint: string; tone: Tone; items: Finding[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <Badge tone={tone} className="tnum">
          {items.length}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      <div className="space-y-2">
        {items.length === 0 && <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-muted">None.</p>}
        {items.map((f) => (
          <details key={f.id} className="group rounded-md border border-line bg-white">
            <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5">
              <ChevronDown className="mt-0.5 size-3.5 shrink-0 -rotate-90 text-muted transition-transform duration-150 group-open:rotate-0" />
              <span className="min-w-0 flex-1 text-sm leading-5 font-medium text-ink">{f.title}</span>
              <span className="flex shrink-0 gap-1">
                <Badge>{f.category}</Badge>
                {f.review && <Badge tone={f.review.state === "approved" ? "green" : f.review.state === "rejected" ? "red" : "amber"}>{f.review.state.replace("_", " ")}</Badge>}
              </span>
            </summary>
            <div className="space-y-2 border-t border-line px-3 py-2.5 pl-8">
              <p className="text-sm leading-6 text-ink">{f.description}</p>
              <EvidenceList items={f.evidence} />
              {f.followUpQuestion && (
                <p className="rounded bg-zinc-50 px-2 py-1.5 text-xs leading-5 text-ink">
                  <span className="font-medium">Follow-up question (auto-generated):</span> {f.followUpQuestion}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function ReadinessTab() {
  const { b, analyze, analyzing } = useWorkspace();
  const [showHistory, setShowHistory] = React.useState(false);
  const cur = b.current;
  if (!cur)
    return (
      <Empty
        title="No analysis yet"
        action={
          <Button variant="primary" onClick={() => analyze()} loading={analyzing}>
            Analyze opportunity
          </Button>
        }
      >
        Analyze runs a Commercial, a Product/Technical and a Legal/Pilot reviewer over the discovery notes and approved sources, then reconciles them. In this demo the passes are simulated from a fixed fixture; no model is called.
      </Empty>
    );
  const a = cur.state;
  const blockers = [...a.blockers].sort((x, y) => Number(x.state === "resolved") - Number(y.state === "resolved"));
  const changedSince = [...a.disagreements.map((d) => d.resolution?.at), ...b.facts.map((f) => f.createdAt), o_notesChanged(b.opportunity.updatedAt, b.audit, cur.createdAt)].filter((t): t is string => !!t && t > cur.createdAt).length;
  const met = a.criteria.filter((c) => c.status === "met").length;
  const partial = a.criteria.filter((c) => c.status === "partial").length;

  return (
    <div className="space-y-6">
      {changedSince > 0 && (
        <Banner tone="teal" className="items-center justify-between">
          <span>
            <strong>Decisions or facts have changed since analysis v{cur.version}.</strong> Re-run to re-evaluate readiness and see what changed.
          </span>
          <Button size="sm" variant="primary" onClick={() => analyze()} loading={analyzing}>
            Re-run analysis
          </Button>
        </Banner>
      )}

      {cur.diff && (
        <Card className="border-violet-200">
          <CardHeader
            title={`What changed: v${cur.diff.fromVersion} → v${cur.diff.toVersion}`}
            sub="Compared with the previous run as originally generated"
            right={
              <span className="tnum flex items-center gap-2 text-lg font-semibold text-ink">
                Score {cur.diff.scoreFrom} <ArrowRight className="size-4 text-muted" /> <span className={cur.diff.scoreTo > cur.diff.scoreFrom ? "text-emerald-700" : cur.diff.scoreTo < cur.diff.scoreFrom ? "text-red-700" : ""}>{cur.diff.scoreTo}</span>
              </span>
            }
          />
          <ul className="space-y-1 px-4 py-3 text-sm leading-6">
            {cur.diff.lines.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">•</span>
                {l}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="grid gap-6 p-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-start gap-5">
            <ScoreDial score={a.completenessScore} />
            <div className="max-w-xs">
              <p className="text-xs font-medium text-muted">Completeness</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{stageLabel(a.readinessStage)}</p>
              <p className="mt-1 text-xs leading-5 text-muted">Share of ten criteria with evidence. This is not a probability of signing.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="amber">Mock analysis · no model called</Badge>
                <Badge className="tnum">v{cur.version}</Badge>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-muted">
                {cur.model} · run by {cur.createdBy} · {fmtTime(cur.createdAt)}
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">How this was determined</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              <span className="tnum font-medium text-ink">
                {met} met × 10 + {partial} partial × 5 = {a.completenessScore}.
              </span>{" "}
              {a.scoringRationale}
            </p>
            <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {CRITERIA.map((c) => {
                const x = a.criteria.find((k) => k.key === c.key);
                const s = x?.status ?? "missing";
                return (
                  <div key={c.key} className="flex items-start gap-2 text-xs leading-5" title={x?.note}>
                    <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", s === "met" ? "bg-emerald-600 text-white" : s === "partial" ? "bg-amber-400 text-white" : "bg-zinc-200 text-zinc-500")}>
                      {s === "met" ? <Check className="size-3" /> : s === "partial" ? <Minus className="size-3" /> : <X className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{c.label}</span> <span className="text-muted">· {s}</span>
                      <span className="block text-muted">{x?.note}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="border-t border-line px-4 py-3">
          <p className="text-xs font-medium text-muted">Executive summary</p>
          <p className="mt-1 text-sm leading-6 whitespace-pre-line text-ink">{a.executiveSummary}</p>
        </div>
        <div className="border-t border-line px-4 py-2">
          <button type="button" className="text-xs font-medium text-muted hover:text-ink" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
            {showHistory ? "Hide" : "Show"} analysis history ({b.runs.length} run{b.runs.length === 1 ? "" : "s"})
          </button>
          {showHistory && (
            <table className="mt-2 mb-1 w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  {["Version", "When", "Run by", "Mode", "Model", "Score", "Stage"].map((h) => (
                    <th key={h} className="py-1 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.runs.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="tnum py-1.5 pr-3 font-medium">v{r.version}</td>
                    <td className="py-1.5 pr-3">{fmtTime(r.createdAt)}</td>
                    <td className="py-1.5 pr-3">{r.createdBy}</td>
                    <td className="py-1.5 pr-3">Mock fixture</td>
                    <td className="py-1.5 pr-3 font-mono">{r.model}</td>
                    <td className="tnum py-1.5 pr-3">{r.score}</td>
                    <td className="py-1.5 pr-3">{stageLabel(r.stage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-ink">Disagreements</h2>
          <p className="text-xs text-muted">
            {a.disagreements.filter((d) => !d.resolution).length} open · {a.disagreements.filter((d) => d.resolution).length} resolved
          </p>
        </div>
        {a.disagreements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-muted">The reviewers did not disagree on anything in this run.</p>
        ) : (
          <div className="space-y-3">
            {a.disagreements.map((d) => (
              <DisagreementCard key={`${d.id}-${d.resolution?.at ?? "open"}`} d={d} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-ink">Blockers</h2>
          <p className="text-xs text-muted">Prioritized. Each has an owner, a next action and evidence.</p>
        </div>
        {blockers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-muted">No blockers in this run.</p>
        ) : (
          <div className="space-y-2.5">
            {blockers.map((x) => (
              <BlockerCard key={x.id} b={x} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">What we know, assume and still need to ask</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <FindingColumn title="Confirmed facts" hint="Backed by an approved or opportunity-level source." tone="green" items={a.findings.filter((f) => f.status === "confirmed")} />
          <FindingColumn title="Assumptions" hint="Plausible, not evidenced. Do not present as fact." tone="amber" items={a.findings.filter((f) => f.status === "assumption")} />
          <FindingColumn title="Unknowns" hint="No evidence. Each has a follow-up question." tone="red" items={a.findings.filter((f) => f.status === "unknown")} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Open questions for the customer" />
          <ul className="space-y-1.5 px-4 py-4 text-sm leading-6">
            {a.customerQuestions.length === 0 && <li className="text-muted">None.</li>}
            {a.customerQuestions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="tnum text-muted">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Proposed milestones and KPIs" sub="Proposals for internal review. Not agreed with the customer." />
          <div className="space-y-3 px-4 py-4 text-sm">
            <ol className="space-y-2">
              {a.proposedMilestones.map((m, i) => (
                <li key={i} className="leading-5">
                  <span className="font-medium text-ink">
                    {i + 1}. {m.title}
                  </span>{" "}
                  <Badge>{roleShort(m.ownerRole)}</Badge>
                  <span className="block text-xs text-muted">Exit: {m.exitCriteria}</span>
                </li>
              ))}
              {a.proposedMilestones.length === 0 && <li className="text-muted">No milestones proposed.</li>}
            </ol>
            {a.proposedKpis.length > 0 && (
              <ul className="space-y-2 border-t border-line pt-3">
                {a.proposedKpis.map((k, i) => (
                  <li key={i} className="leading-5">
                    <span className="font-medium text-ink">{k.name}</span>
                    <span className="block text-xs text-muted">
                      {k.measurement} · Baseline: {k.baselineStatus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Returns the time of the last notes edit if it happened after the run, so the re-run prompt appears. */
function o_notesChanged(_updatedAt: string, auditLog: { action: string; detail: string; createdAt: string }[], runAt: string): string | undefined {
  return auditLog.find((e) => e.action === "Edited opportunity" && e.detail.includes("discovery notes") && e.createdAt > runAt)?.createdAt;
}
