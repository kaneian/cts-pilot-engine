"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Badge, Banner, Button, cn } from "@/components/ui";
import { ApiError, ago, api, useAutoRefresh, useRole, useToast } from "@/components/shell";
import { WorkspaceCtx, type Workspace } from "@/components/common";
import { roleShort, stageLabel, type Bundle } from "@/lib/types";
import { DiscoveryTab } from "@/components/workspace/discovery";
import { ReadinessTab } from "@/components/workspace/readiness";
import { ReviewTab } from "@/components/workspace/review";
import { PackageTab } from "@/components/workspace/package";

const TABS = [
  { key: "discovery", label: "Discovery" },
  { key: "readiness", label: "Readiness" },
  { key: "review", label: "Team Review" },
  { key: "package", label: "Pilot Package" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PASS_STEPS = ["Commercial reviewer: pain, sponsor, economics…", "Product/Technical reviewer: capability claims against approved sources…", "Legal/Pilot reviewer: missing terms and approvals…", "Reconciler: merging findings, surfacing disagreements…"];
const STEP_MS = 550;

export default function OpportunityPage() {
  const id = useSearchParams().get("id") ?? "";
  const { role } = useRole();
  const toast = useToast();
  const [b, setB] = React.useState<Bundle | null>(null);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState<TabKey>("discovery");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const busy = React.useRef(0);

  // The tab survives a refresh via the URL hash.
  React.useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.key === h)) setTab(h as TabKey);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [id]);
  const pickTab = (t: TabKey) => {
    setTab(t);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${t}`);
  };

  React.useEffect(() => {
    setB(null);
    setError("");
  }, [id]);

  const load = React.useCallback(async () => {
    if (!id) return setError("No opportunity selected.");
    try {
      const data = await api<Bundle>(`/api/opportunities/${id}`);
      if (busy.current === 0) setB(data);
      setError("");
    } catch (e) {
      setError((e as ApiError).status === 404 ? "This opportunity is not in this browser's mock data. It may have been reset." : (e as Error).message);
    }
  }, [id]);
  const paused = React.useCallback(() => busy.current > 0, []);
  useAutoRefresh(load, paused);

  const act = React.useCallback<Workspace["act"]>(
    async (action, okMessage) => {
      busy.current++;
      try {
        const r = await api<{ bundle: Bundle; note?: string }>(`/api/opportunities/${id}/actions`, { ...action, actor: role });
        setB(r.bundle);
        if (r.note) toast(r.note, "error");
        else if (okMessage) toast(okMessage);
        return true;
      } catch (e) {
        toast((e as Error).message, "error");
        if ((e as ApiError).status === 409 || (e as ApiError).status === 404) load();
        return false;
      } finally {
        busy.current--;
      }
    },
    [id, role, toast, load],
  );

  const analyze = React.useCallback<Workspace["analyze"]>(async () => {
    busy.current++;
    setAnalyzing(true);
    try {
      // The passes are simulated: no model is called. The short walk-through shows what a live run would do.
      for (let i = 0; i < PASS_STEPS.length; i++) {
        setStep(i);
        await new Promise((r) => setTimeout(r, STEP_MS));
      }
      const data = await api<Bundle>(`/api/opportunities/${id}/analyze`, { actor: role });
      setB(data);
      setTab("readiness");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#readiness`);
      toast(`Mock analysis v${data.current?.version} ready. No model was called.`);
    } catch (e) {
      toast(`${(e as Error).message} Nothing was changed.`, "error");
    } finally {
      busy.current--;
      setAnalyzing(false);
    }
  }, [id, role, toast]);

  const saveNotes = React.useCallback<Workspace["saveNotes"]>(
    async (notes, expectedVersion) => {
      busy.current++;
      try {
        setB(await api<Bundle>(`/api/opportunities/${id}`, { actor: role, notes, expectedVersion }, "PATCH"));
        toast("Notes saved.");
        return true;
      } catch (e) {
        toast((e as Error).message, "error");
        if ((e as ApiError).status === 409) load();
        return false;
      } finally {
        busy.current--;
      }
    },
    [id, role, toast, load],
  );

  if (error && !b)
    return (
      <div className="space-y-4">
        <Banner tone="red">{error}</Banner>
        <Link href="/">
          <Button>Back to overview</Button>
        </Link>
      </div>
    );
  if (!b)
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-80" />
        <div className="skeleton h-64" />
      </div>
    );

  const o = b.opportunity;
  const st = b.current?.state;
  const openDis = st?.disagreements.filter((d) => !d.resolution).length ?? 0;
  const pending = st?.findings.filter((f) => !f.review).length ?? 0;
  const counts: Record<TabKey, number | null> = {
    discovery: null,
    readiness: st ? st.blockers.filter((x) => x.state === "open" || x.state === "in_review").length : null,
    review: st ? pending + openDis : null,
    package: null,
  };

  return (
    <WorkspaceCtx.Provider value={{ b, act, analyze, analyzing, saveNotes }}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{o.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
              <Badge tone="navy">{stageLabel(st?.readinessStage ?? o.stage)}</Badge>
              {st && <Badge tone="amber">Mock analysis</Badge>}
              <span>{o.useCase}</span>
              <span>· Owner: {roleShort(o.ownerRole)}</span>
              <span>· {st ? `${pending} finding${pending === 1 ? "" : "s"} unreviewed, ${openDis} disagreement${openDis === 1 ? "" : "s"} open` : "Not analyzed yet"}</span>
              <span>· Updated {ago(o.updatedAt)}</span>
            </div>
          </div>
          <Button variant="primary" onClick={() => analyze()} loading={analyzing}>
            {!analyzing && <Sparkles className="size-3.5" />}
            {st ? "Re-run analysis" : "Analyze opportunity"}
          </Button>
        </div>

        {analyzing && (
          <Banner tone="navy" className="items-center">
            <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            <span>
              <strong>Simulated pass {step + 1} of 4.</strong> {PASS_STEPS[step]}
            </span>
          </Banner>
        )}
        {b.injectionFlags.length > 0 && (
          <Banner tone="red">
            <span>
              <strong>Possible embedded instruction in the sources.</strong> It is treated as data and does not change the analysis rules: <span className="font-mono">{b.injectionFlags[0]}</span>
            </span>
          </Banner>
        )}
        {error && <Banner tone="red">{error} Showing the last loaded data.</Banner>}

        <div className="flex gap-0.5 border-b border-line" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => pickTab(t.key)} className={cn("t-quick -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium", tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
              {t.label}
              {counts[t.key] ? <span className="tnum rounded bg-zinc-100 px-1.5 text-[11px] leading-4 text-zinc-700">{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>

        <div key={tab} className="rise">
          {tab === "discovery" && <DiscoveryTab />}
          {tab === "readiness" && <ReadinessTab />}
          {tab === "review" && <ReviewTab />}
          {tab === "package" && <PackageTab />}
        </div>
      </div>
    </WorkspaceCtx.Provider>
  );
}
