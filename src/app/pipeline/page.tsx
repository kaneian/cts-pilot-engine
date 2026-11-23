"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleCheck, TriangleAlert } from "lucide-react";
import { Badge, Banner, Button, Card, CardHeader, Empty, cn } from "@/components/ui";
import { api, download, oppHref, useRole, useToast } from "@/components/shell";
import { SEED_ATTENDEES_CSV } from "@/lib/demo-data";
import { FilePick, ScoreBar } from "@/components/common";
import type { Institution } from "@/lib/types";

export default function PipelinePage() {
  const [rows, setRows] = React.useState<Institution[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState("");
  const { role } = useRole();
  const toast = useToast();
  const router = useRouter();

  React.useEffect(() => {
    api<{ institutions: Institution[] }>("/api/pipeline")
      .then((r) => setRows(r.institutions))
      .catch((e) => toast(e.message, "error"));
  }, [toast]);

  const importBody = async (body: Record<string, unknown>) => {
    setBusy("import");
    try {
      const r = await api<{ institutions: Institution[] }>("/api/pipeline", body);
      setRows(r.institutions);
      toast(`${r.institutions.length} rows imported and scored.`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setBusy("");
  };

  const promote = async (i: Institution) => {
    setBusy(i.id);
    try {
      const r = await api<{ opportunityId: string }>("/api/pipeline/promote", { institutionId: i.id, actor: role });
      router.push(oppHref(r.opportunityId));
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy("");
    }
  };

  const fis = rows?.filter((r) => r.isFi) ?? [];
  const others = rows?.filter((r) => !r.isFi) ?? [];
  const fictional = rows?.some((r) => /fictional/i.test(r.batch));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pipeline Intake</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Import a conference attendee list, rank the institutions, and promote the best ones to opportunities. This is the front door; the depth is in the opportunity workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => importBody({ seed: true })} loading={busy === "import"}>
            Load mock attendee list
          </Button>
          <Button onClick={() => download("attendees-sample.csv", SEED_ATTENDEES_CSV)}>Sample CSV</Button>
          <FilePick
            label="Import CSV"
            accept=".csv"
            onFile={async (f) => {
              if (f.size > 1_000_000) return toast("That CSV is too large. The limit is 1 MB.", "error");
              importBody({ fileName: f.name, text: await f.text() });
            }}
          />
        </div>
      </div>

      {fictional && <Banner tone="teal">This list is fictional mock data. The institutions are invented.</Banner>}
      <Banner>
        <span>
          <strong>How scoring works.</strong> Scores are rule-based and come only from the cells in your CSV: institution type (30), asset size (20), core provider (15), contact role (20), stated interest (15). No model and no web lookup is used. A fact is marked verified only when the CSV&rsquo;s <code className="font-mono">verified_fields</code> column lists it; everything else is unverified until a person checks it.
        </span>
      </Banner>

      {rows === null ? (
        <div className="skeleton h-64" />
      ) : rows.length === 0 ? (
        <Empty
          title="No attendee list imported"
          action={
            <Button variant="primary" onClick={() => importBody({ seed: true })} loading={busy === "import"}>
              Load mock attendee list
            </Button>
          }
        >
          Import a CSV with columns: institution, type, asset_size_usd_m, core_provider, contact_title, interest_notes, verified_fields. A CSV you import is read in this browser only and is never uploaded.
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader title={`Ranked institutions (${fis.length})`} sub={`From ${rows[0].batch}. Click a row for the score breakdown.`} />
            <ul className="divide-y divide-line">
              {fis.map((i, idx) => {
                const unverified = i.breakdown.filter((x) => !x.verified).length;
                return (
                  <li key={i.id}>
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <button type="button" aria-expanded={open === i.id} aria-label="Show score breakdown" onClick={() => setOpen(open === i.id ? null : i.id)} className="text-muted hover:text-ink">
                        <ChevronDown className={cn("size-4 transition-transform duration-150", open !== i.id && "-rotate-90")} />
                      </button>
                      <span className="tnum w-6 text-xs text-muted">{idx + 1}</span>
                      <button type="button" onClick={() => setOpen(open === i.id ? null : i.id)} className="min-w-0 flex-1 text-left">
                        <span className="text-sm font-medium text-ink">{i.name}</span>
                        <span className="ml-2 text-xs text-muted">
                          {i.data.type} {i.data.contact_title && `· ${i.data.contact_title}`}
                        </span>
                      </button>
                      {unverified > 0 && (
                        <Badge tone="amber">
                          <TriangleAlert className="size-3" />
                          {unverified} unverified
                        </Badge>
                      )}
                      <ScoreBar score={i.score} />
                      {i.promotedOpportunityId ? (
                        <Link href={oppHref(i.promotedOpportunityId)}>
                          <Button size="sm">Open opportunity</Button>
                        </Link>
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => promote(i)} loading={busy === i.id}>
                          Promote to opportunity
                        </Button>
                      )}
                    </div>
                    {open === i.id && (
                      <div className="rise border-t border-line bg-zinc-50/60 px-4 py-3 pl-[72px]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted">
                              <th className="py-1 pr-3 font-medium">Factor</th>
                              <th className="py-1 pr-3 font-medium">Points</th>
                              <th className="py-1 pr-3 font-medium">Fact</th>
                              <th className="py-1 pr-3 font-medium">Source</th>
                              <th className="py-1 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {i.breakdown.map((x) => (
                              <tr key={x.factor} className="border-t border-line align-top">
                                <td className="py-1.5 pr-3 font-medium text-ink">{x.factor}</td>
                                <td className="tnum py-1.5 pr-3">
                                  {x.points} / {x.max}
                                </td>
                                <td className="py-1.5 pr-3 text-ink">{x.fact}</td>
                                <td className="py-1.5 pr-3 text-muted">{x.source}</td>
                                <td className="py-1.5 whitespace-nowrap">
                                  {x.verified ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700">
                                      <CircleCheck className="size-3.5" /> verified
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-700">
                                      <TriangleAlert className="size-3.5" /> unverified
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t border-line font-semibold text-ink">
                              <td className="py-1.5 pr-3">Total</td>
                              <td className="tnum py-1.5 pr-3">{i.score} / 100</td>
                              <td colSpan={3} />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
          {others.length > 0 && (
            <Card>
              <CardHeader title={`Not financial institutions (${others.length})`} sub="Excluded from ranking. They cannot be promoted." />
              <ul className="divide-y divide-line">
                {others.map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-ink">{i.name}</span>
                    <span className="text-xs text-muted">
                      {i.data.type || "type not provided"} · {i.breakdown[0]?.source}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
