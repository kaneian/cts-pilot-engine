"use client";

import * as React from "react";
import { Check, CircleHelp, MessageSquare, X } from "lucide-react";
import { Badge, Banner, Button, Card, CardHeader, Empty, EvidenceList, Input, Segmented, Textarea, cn } from "@/components/ui";
import { fmtTime, useRole } from "@/components/shell";
import { useWorkspace } from "@/components/common";
import { ROLES, roleLabel, type Finding, type RoleKey } from "@/lib/types";

const REVIEW_TONE = { approved: "green", rejected: "red", needs_evidence: "amber" } as const;

function FindingRow({ f }: { f: Finding }) {
  const { b, act } = useWorkspace();
  const { role } = useRole();
  const [rationale, setRationale] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [showThread, setShowThread] = React.useState(false);
  const thread = b.comments.filter((c) => c.targetType === "finding" && c.targetId === f.id);
  const review = async (state: "approved" | "rejected" | "needs_evidence") => {
    if (state !== "approved" && rationale.trim().length < 3) return;
    if (await act({ type: "reviewFinding", findingId: f.id, state, rationale }, `Marked ${state.replace("_", " ")}.`)) setRationale("");
  };
  const needsReason = rationale.trim().length < 3;
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
            <Badge>{f.category}</Badge>
            <Badge tone={f.status === "confirmed" ? "green" : f.status === "assumption" ? "amber" : "red"}>{f.status}</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink">{f.description}</p>
        </div>
        {f.review ? <Badge tone={REVIEW_TONE[f.review.state]}>{f.review.state.replace("_", " ")} · {f.review.by}</Badge> : <Badge>Not reviewed</Badge>}
      </div>
      <div className="mt-2">
        <EvidenceList items={f.evidence} />
      </div>
      {f.review && (
        <p className="mt-2 text-xs text-muted">
          {f.review.by} marked this {f.review.state.replace("_", " ")} on {fmtTime(f.review.at)}
          {f.review.rationale ? `: “${f.review.rationale}”` : "."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input aria-label="Review rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Rationale (required to reject or request evidence)" className="h-8 max-w-sm flex-1 text-xs" />
        <Button size="sm" onClick={() => review("approved")} className="border-emerald-200 text-emerald-800 hover:bg-emerald-50">
          <Check className="size-3.5" />
          Approve
        </Button>
        <Button size="sm" variant="danger" disabled={needsReason} title={needsReason ? "Add a rationale first" : undefined} onClick={() => review("rejected")}>
          <X className="size-3.5" />
          Reject
        </Button>
        <Button size="sm" disabled={needsReason} title={needsReason ? "Add a rationale first" : undefined} onClick={() => review("needs_evidence")} className="border-amber-200 text-amber-800 hover:bg-amber-50">
          <CircleHelp className="size-3.5" />
          Needs evidence
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowThread(!showThread)} aria-expanded={showThread}>
          <MessageSquare className="size-3.5" />
          {thread.length ? `${thread.length} comment${thread.length === 1 ? "" : "s"}` : "Comment"}
        </Button>
      </div>
      {showThread && (
        <div className="mt-3 space-y-2 rounded-md bg-zinc-50 p-3">
          {thread
            .slice()
            .reverse()
            .map((c) => (
              <div key={c.id} className="text-sm leading-5">
                <span className="font-medium text-ink">{c.role}</span> <span className="text-xs text-muted">{fmtTime(c.createdAt)}</span>
                <p className="text-ink">{c.body}</p>
              </div>
            ))}
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ type: "addComment", targetType: "finding", targetId: f.id, targetLabel: f.title, body: comment })) setComment("");
            }}
          >
            <Input aria-label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={`Comment as ${roleLabel(role)}`} className="h-8 text-xs" />
            <Button size="sm" type="submit" disabled={!comment.trim()}>
              Post
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}

export function ReviewTab() {
  const { b, act } = useWorkspace();
  const { role, setRole } = useRole();
  const [filter, setFilter] = React.useState<"pending" | "all" | "mine">("pending");
  const [general, setGeneral] = React.useState("");
  const a = b.current?.state;
  const me = roleLabel(role);

  if (!a) return <Empty title="Nothing to review yet">Run an analysis from the Discovery or Readiness tab. Findings, decisions and comments will appear here.</Empty>;

  const mineCats: Record<RoleKey, string[]> = { partnerships: ["commercial"], commercial: ["commercial"], product: ["product"], engineering: ["technical", "product"], legal: ["legal"] };
  const list = a.findings.filter((f) => (filter === "pending" ? !f.review || f.review.state === "needs_evidence" : filter === "mine" ? mineCats[role].includes(f.category) : true));
  const generalThread = b.comments.filter((c) => c.targetType === "opportunity");
  const reviewed = a.findings.filter((f) => f.review).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <p className="text-xs font-medium text-muted">You are reviewing as</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ROLES.map((r) => (
                  <button key={r.key} type="button" aria-pressed={role === r.key} onClick={() => setRole(r.key)} className={cn("t-quick rounded-md border px-2.5 py-1.5 text-xs font-medium", role === r.key ? "border-navy-800 bg-navy-900 text-white" : "border-line bg-white text-muted hover:text-ink")}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <Banner className="max-w-xs">Simulated role selector for the demo. It is not sign-in or access control. Every action is recorded under the selected role.</Banner>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Findings"
            sub={`${reviewed} of ${a.findings.length} reviewed. An AI finding is never shown as human-approved without a click here.`}
            right={
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "pending", label: "Needs review" },
                  { value: "mine", label: "My area" },
                  { value: "all", label: "All" },
                ]}
              />
            }
          />
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{filter === "pending" ? "Every finding has been reviewed." : "No findings match this filter."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {list.map((f) => (
                <FindingRow key={f.id} f={f} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Team discussion" sub="General comments on this opportunity" />
          <div className="space-y-3 p-5">
            {generalThread.length === 0 && <p className="text-xs text-muted">No comments yet.</p>}
            {generalThread
              .slice()
              .reverse()
              .map((c) => (
                <div key={c.id} className="text-sm leading-6">
                  <span className="font-medium text-ink">{c.role}</span> <span className="text-xs text-muted">{fmtTime(c.createdAt)}</span>
                  <p className="whitespace-pre-line text-ink">{c.body}</p>
                </div>
              ))}
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act({ type: "addComment", targetType: "opportunity", targetId: b.opportunity.id, targetLabel: "", body: general })) setGeneral("");
              }}
            >
              <Textarea aria-label="Comment" rows={2} value={general} onChange={(e) => setGeneral(e.target.value)} placeholder={`Comment as ${me}`} />
              <div className="flex justify-end">
                <Button type="submit" disabled={!general.trim()}>
                  Post comment
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>

      <Card className="h-fit xl:sticky xl:top-6">
        <CardHeader title="Audit trail" sub="Who did what, newest first. Persists across refresh." />
        <ol className="max-h-[70vh] divide-y divide-line overflow-y-auto">
          {b.audit.map((e) => (
            <li key={e.id} className="px-4 py-2.5">
              <p className="text-xs">
                <span className="font-semibold text-ink">{e.actor}</span> <span className="text-muted">· {fmtTime(e.createdAt)}</span>
              </p>
              <p className="mt-0.5 text-sm font-medium text-ink">{e.action}</p>
              {e.detail && <p className="mt-0.5 text-xs leading-5 break-words text-muted">{e.detail}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
