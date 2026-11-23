"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Banner, Button, Card } from "@/components/ui";
import { api, oppHref, useToast } from "@/components/shell";
import type { Dashboard } from "@/lib/store";

const STEPS: { time: string; title: string; say: string; do: string[]; link?: "northstar" | "lakeshore" | "pipeline" | "dashboard"; tab?: string }[] = [
  { time: "0:00–0:30", title: "Problem", say: "We have bank conversations. Deals stall because five teams work from scattered notes and unverified assumptions.", do: ["Open the Overview. Point at the readiness dial, the four numbers and the opportunity table."], link: "dashboard" },
  { time: "0:30–1:30", title: "Input", say: "This is where an opportunity comes from, and what we know after the first call.", do: ["Optional, 15 seconds: Pipeline Intake → Load mock attendee list → expand one row → Promote to opportunity.", "Open Northstar. Show the discovery notes.", "Click Analyze opportunity. Four simulated reviewer passes run."], link: "northstar", tab: "discovery" },
  { time: "1:30–2:30", title: "Readiness", say: "The score is the share of ten criteria with evidence, not a chance of signing. Unsupported capabilities are flagged for technical validation.", do: ["Read out “How this was determined.”", "Expand the top blocker: evidence, owner, next action.", "Open the unknown “Cross-bank 24/7 settlement support is unverified.”"], link: "northstar", tab: "readiness" },
  { time: "2:30–3:30", title: "Multiplayer", say: "Commercial wants cross-bank settlement. Engineering wants internal transfers. The AI does not pick a winner. A person does.", do: ["Switch role to Engineering. On the scope disagreement choose “Adopt: Proposed resolution,” type a rationale, Record decision.", "Switch role to Eran · Commercial. Click Approve.", "Refresh the browser. The decision and approval are still there.", "Click Re-run analysis. Show the “What changed” card."], link: "northstar", tab: "readiness" },
  { time: "3:30–4:30", title: "Deliverables", say: "The brief only says what the record supports. The agreement only comes from an approved template.", do: ["Pilot Package → Generate draft brief → Download .md.", "Note the locked MOU panel on Northstar: no template, no MOU.", "Open Lakeshore → Analyze → Pilot Package → Load fictional demo template.", "Switch role to Legal → Mark approved → Populate agreement draft. Point at the [TO CONFIRM] fields."], link: "lakeshore", tab: "package" },
  { time: "4:30–5:00", title: "Value", say: "Everything on this card is counted from what we just did. Nothing is estimated.", do: ["Back to the Overview: the numbers and the activity feed have moved.", "Team Review → Audit trail: who decided what, and why."], link: "dashboard" },
];

export default function DemoGuidePage() {
  const [d, setD] = React.useState<Dashboard | null>(null);
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  const load = React.useCallback(() => api<Dashboard>("/api/dashboard").then(setD).catch(() => {}), []);
  React.useEffect(() => {
    load();
  }, [load]);

  const ids = { northstar: d?.opportunities.find((o) => o.fixtureKey === "northstar")?.id, lakeshore: d?.opportunities.find((o) => o.fixtureKey === "lakeshore")?.id };
  const href = (s: (typeof STEPS)[number]) => (s.link === "dashboard" ? "/" : s.link === "pipeline" ? "/pipeline" : s.link && ids[s.link] ? oppHref(ids[s.link]!, s.tab) : null);

  const reset = async () => {
    if (!window.confirm("Reset all mock data to its original state? Anything you changed in this browser will be cleared.")) return;
    setBusy(true);
    try {
      await api("/api/demo", {});
      await load();
      toast("Mock data reset.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Demo guide</h1>
          <p className="mt-0.5 text-xs text-muted">The five-minute path. Every step uses fictional data.</p>
        </div>
        <Button variant="primary" onClick={reset} loading={busy}>
          Reset mock data
        </Button>
      </div>

      <Banner>
        <span>
          <strong>Mock data, no model.</strong> This build runs entirely in your browser. The reviewer passes are simulated from fixed fixtures and are labeled &ldquo;Mock analysis&rdquo; wherever they appear. Say so out loud. To show two people at once, open a second tab: both tabs share the same data.
        </span>
      </Banner>

      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const h = href(s);
          return (
            <li key={i}>
              <Card className="grid gap-4 p-4 md:grid-cols-[120px_minmax(0,1fr)_auto]">
                <div>
                  <p className="tnum font-mono text-xs text-muted">{s.time}</p>
                  <p className="mt-0.5 text-base font-semibold text-ink">
                    {i + 1}. {s.title}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-6 text-ink">&ldquo;{s.say}&rdquo;</p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-muted">
                    {s.do.map((x, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-accent">→</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                  {i === 5 && d && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="green">measured</Badge>
                      <span className="tnum text-xs text-ink">
                        {d.value.blockersSurfaced} blockers surfaced · {d.value.ownersAssigned} owners assigned · {d.value.decisionsRecorded} decisions recorded · {d.value.documentsProduced} documents produced
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  {i === 1 && (
                    <Link href="/pipeline">
                      <Button size="sm">Pipeline</Button>
                    </Link>
                  )}
                  {h ? (
                    <Button size="sm" variant="primary" onClick={() => router.push(h)}>
                      Open
                    </Button>
                  ) : (
                    <Button size="sm" onClick={reset} loading={busy}>
                      Reset mock data
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">If someone asks</h2>
        <dl className="mt-3 space-y-3 text-sm leading-6">
          <div>
            <dt className="font-medium text-ink">Is the role switcher real access control?</dt>
            <dd className="text-muted">No. It is a simulated selector so one presenter can show five teams. Actions are attributed to the selected role.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">What stops the AI inventing a capability or a price?</dt>
            <dd className="text-muted">In this demo nothing is generated by a model. The guards that would sit behind one still run on every analysis: each excerpt is checked against its source and downgraded to unverified if it is not there, demo-only material never counts as support, and currency amounts without an approved source become [TO CONFIRM].</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Can I show the prompt-injection defense?</dt>
            <dd className="text-muted">Yes. Discovery → Edit notes → &ldquo;Append a sample injection line&rdquo; → Save → Re-run. A red banner flags the line, and the stage, score and pricing do not change.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Is any of this real data?</dt>
            <dd className="text-muted">No. Every institution, person, note and number is invented, and nothing leaves the browser. Counts on the Overview are computed from the mock records, not estimated.</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
