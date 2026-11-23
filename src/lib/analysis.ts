import { CRITERIA, criterionLabel, scoreFromCriteria, stageLabel, type CriterionAssessment, type Evidence, type Fact, type Opportunity, type PilotAnalysis, type RunDiff, type SourceDoc } from "./types";
import { loadKnowledge } from "./knowledge";
import { FIXTURES, genericFixture } from "./demo-data";

/* ---------- Source registry and grounding ---------- */

export type Source = { id: string; name: string; tier: 1 | 2 | 3 | 0; text: string };

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[–—-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export function buildSources(opp: Opportunity, docs: SourceDoc[], facts: Fact[], prev: PilotAnalysis | null): Source[] {
  const out: Source[] = [];
  for (const k of loadKnowledge()) {
    out.push({ id: k.path, name: k.path, tier: k.tier === "approved" ? 1 : k.tier === "demo_only" ? 3 : 0, text: k.body });
  }
  for (const d of docs) {
    if (d.kind === "template") continue;
    out.push({ id: d.id, name: d.name, tier: d.approval === "approved" ? 1 : d.approval === "demo_only" ? 3 : 0, text: d.content.slice(0, 20000) });
  }
  out.push({ id: "notes", name: "Discovery notes", tier: 2, text: opp.notes.slice(0, 30000) });
  if (facts.length) out.push({ id: "facts", name: "Confirmed facts", tier: 2, text: facts.map((f) => `- ${f.text} (confirmed by ${f.by})`).join("\n") });
  const decisions = humanDecisionText(prev);
  if (decisions) out.push({ id: "decisions", name: "Human decisions", tier: 2, text: decisions });
  return out;
}

function humanDecisionText(prev: PilotAnalysis | null): string {
  if (!prev) return "";
  const lines: string[] = [];
  for (const d of prev.disagreements)
    if (d.resolution) lines.push(`- Disagreement "${d.topic}" resolved by ${d.resolution.by}. Adopted: ${d.resolution.adopted} Rationale: ${d.resolution.rationale}`);
  for (const f of prev.findings)
    if (f.review) lines.push(`- Finding "${f.title}" marked ${f.review.state.replace("_", " ")} by ${f.review.by}${f.review.rationale ? `. Rationale: ${f.review.rationale}` : ""}`);
  return lines.join("\n");
}

function verifyEvidence(e: Evidence, sources: Source[]): Evidence {
  const byRef = sources.find((s) => s.id === e.sourceId) ?? sources.find((s) => norm(s.name) === norm(e.sourceName)) ?? sources.find((s) => norm(e.sourceName).includes(norm(s.name)));
  if (!e.excerpt) return e.evidenceStatus === "supported" ? { ...e, evidenceStatus: "unverified" } : e;
  const ex = norm(e.excerpt).replace(/…$/, "");
  const hit = (byRef && norm(byRef.text).includes(ex) ? byRef : undefined) ?? sources.find((s) => ex.length > 12 && norm(s.text).includes(ex));
  if (!hit) return { ...e, evidenceStatus: e.evidenceStatus === "contradictory" ? "contradictory" : "unverified", sourceName: `${e.sourceName} (excerpt not found in source)` };
  // Demo-only and unapproved material can never make a claim "supported".
  if ((hit.tier === 3 || hit.tier === 0) && e.evidenceStatus === "supported") return { ...e, sourceId: hit.id, evidenceStatus: "unverified" };
  return { ...e, sourceId: hit.id };
}

const MONEY = /(?:(?:US)?\$|USD\s?|€|£)\s?\d[\d,.]*\s?(?:k|m|mm|bn|b|million|billion|thousand)?\b|\b\d[\d,.]*\s?(?:basis points|bps)\b/gi;

function deepMapStrings<T>(v: T, fn: (s: string) => string): T {
  if (typeof v === "string") return fn(v) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => deepMapStrings(x, fn)) as unknown as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === "id" || k === "sourceId" || k === "at" ? x : deepMapStrings(x, fn);
    return o as T;
  }
  return v;
}

/** Guards applied to every analysis, live or fixture. */
export function applyGuards(a: PilotAnalysis, sources: Source[]): PilotAnalysis {
  const allowedMoney = new Set<string>();
  for (const s of sources) {
    if (s.tier !== 1 && s.tier !== 2) continue;
    // Amounts on lines that look like embedded instructions are never treated as sourced.
    const clean = s.text
      .split(/\r?\n/)
      .filter((line) => !INJECTION_PATTERNS.some((p) => p.test(line)))
      .join("\n");
    for (const m of clean.match(MONEY) ?? []) allowedMoney.add(norm(m));
  }
  let out = deepMapStrings(a, (s) =>
    s
      .replace(MONEY, (m) => (allowedMoney.has(norm(m)) ? m : "[TO CONFIRM]"))
      .replace(/(?<!not )ready for signature/gi, "[not available: requires Legal review]")
      .replace(/legally binding/gi, "[not legal advice]"),
  );
  const questions = new Set(out.customerQuestions);
  out = {
    ...out,
    findings: out.findings.map((f) => {
      const evidence = f.evidence.map((e) => verifyEvidence(e, sources));
      const supported = evidence.some((e) => e.evidenceStatus === "supported");
      const status = f.status === "confirmed" && !supported ? "assumption" : f.status;
      let followUpQuestion = f.followUpQuestion;
      if (status !== "confirmed" || !supported) {
        followUpQuestion = followUpQuestion || `Can you confirm: ${f.title.replace(/[.?]$/, "")}?`;
        questions.add(followUpQuestion);
      }
      return { ...f, evidence, status, followUpQuestion };
    }),
    blockers: out.blockers.map((b) => ({ ...b, evidence: b.evidence.map((e) => verifyEvidence(e, sources)) })),
  };
  out.customerQuestions = [...questions].slice(0, 30);
  // Criteria that depend on approved Cosmos references cannot be "met" without one.
  const tier1 = sources.filter((s) => s.tier === 1);
  const hasFacts = sources.some((s) => s.id === "facts");
  out.criteria = out.criteria.map((c) => {
    if (c.key === "commercial_terms" && c.status !== "missing" && !tier1.some((s) => /commercial|offer|pricing/i.test(s.name)) && !hasFacts)
      return { ...c, status: "missing" as const, note: "No approved commercial offer on file. All commercial terms are [TO CONFIRM]." };
    if (c.key === "technical_feasibility" && c.status === "met" && !tier1.length)
      return { ...c, status: "partial" as const, note: `${c.note} (Capped at partial: no approved CTS reference is on file to confirm it.)` };
    return c;
  });
  return normalize(out);
}

export function normalize(a: PilotAnalysis): PilotAnalysis {
  const criteria: CriterionAssessment[] = CRITERIA.map(
    (c) => a.criteria.find((x) => x.key === c.key) ?? { key: c.key, status: "missing" as const, note: "No evidence in the sources." },
  );
  const seen = new Set<string>();
  const uniq = <T extends { id: string }>(items: T[], prefix: string) =>
    items.map((it, i) => {
      let id = it.id || `${prefix}-${i + 1}`;
      while (seen.has(id)) id = `${id}-${i + 1}`;
      seen.add(id);
      return { ...it, id };
    });
  const findings = uniq(a.findings, "f");
  const blockers = uniq(a.blockers, "b");
  const disagreements = uniq(a.disagreements, "d").map((d) => ({ ...d, resolutionStatus: d.resolution ? ("resolved" as const) : ("open" as const) }));
  let stage = a.readinessStage;
  const openHigh = blockers.some((b) => b.priority === "high" && (b.state === "open" || b.state === "in_review"));
  const openDis = disagreements.some((d) => d.resolutionStatus === "open");
  if (stage === "ready_for_customer_review" && (openHigh || openDis)) stage = "pending_internal_approval";
  if (stage === "pending_internal_approval" && openDis) stage = "pilot_scoping";
  return { ...a, criteria, findings, blockers, disagreements, readinessStage: stage, completenessScore: scoreFromCriteria(criteria) };
}

/* ---------- Human decisions carry forward across runs ---------- */

const sameTitle = (a: string, b: string) => norm(a) === norm(b);

export function carryForward(next: PilotAnalysis, prev: PilotAnalysis | null, facts: Fact[], fixtureMode: boolean): PilotAnalysis {
  const out: PilotAnalysis = JSON.parse(JSON.stringify(next));
  if (prev) {
    for (const pd of prev.disagreements) {
      if (!pd.resolution) continue;
      const nd = out.disagreements.find((d) => d.id === pd.id) ?? out.disagreements.find((d) => sameTitle(d.topic, pd.topic));
      if (nd) {
        nd.resolution = pd.resolution;
        nd.resolutionStatus = "resolved";
        nd.criterion = nd.criterion ?? pd.criterion;
        nd.blockerIds = nd.blockerIds ?? pd.blockerIds;
      } else out.disagreements.push(pd); // a recorded decision never disappears
    }
    for (const pf of prev.findings) {
      if (!pf.review) continue;
      const nf = out.findings.find((f) => f.id === pf.id) ?? out.findings.find((f) => sameTitle(f.title, pf.title));
      if (nf) nf.review = pf.review;
    }
    for (const pb of prev.blockers) {
      if (!pb.lastEditedBy) continue;
      const nb = out.blockers.find((b) => b.id === pb.id) ?? out.blockers.find((b) => sameTitle(b.title, pb.title));
      if (nb) Object.assign(nb, { state: pb.state, ownerRole: pb.ownerRole, deadline: pb.deadline, priority: pb.priority, recommendedAction: pb.recommendedAction, lastEditedBy: pb.lastEditedBy, lastEditedAt: pb.lastEditedAt });
    }
  }
  if (fixtureMode) {
    // Fixtures cannot reason, so recorded human decisions are applied by rule.
    const decided: string[] = [];
    for (const d of out.disagreements) {
      if (!d.resolution) continue;
      decided.push(`${d.topic}: ${d.resolution.adopted} (decided by ${d.resolution.by})`);
      for (const id of d.blockerIds ?? []) {
        const b = out.blockers.find((x) => x.id === id);
        if (b && !b.lastEditedBy) b.state = "resolved";
      }
      if (d.criterion) {
        const c = out.criteria.find((x) => x.key === d.criterion);
        if (c) {
          c.status = "met";
          c.note = `Decided by ${d.resolution.by}: ${d.resolution.adopted}`;
        }
      }
    }
    for (const f of facts) {
      out.findings.unshift({
        id: `fact-${f.id.slice(0, 8)}`,
        title: f.text.length > 90 ? f.text.slice(0, 90) + "…" : f.text,
        description: f.text,
        category: "commercial",
        status: "confirmed",
        evidence: [{ sourceId: "facts", sourceName: `Confirmed fact (${f.by})`, excerpt: f.text.slice(0, 500), evidenceStatus: "supported" }],
      });
    }
    if (decided.length) out.executiveSummary += `\n\nDecisions on record: ${decided.join(" · ")}`;
  }
  return normalize(out);
}

/* ---------- Diff between runs ---------- */

export function diffRuns(prev: PilotAnalysis, next: PilotAnalysis, fromVersion: number, toVersion: number): RunDiff {
  const lines: string[] = [];
  for (const c of next.criteria) {
    const p = prev.criteria.find((x) => x.key === c.key);
    if (p && p.status !== c.status) lines.push(`${criterionLabel(c.key)}: ${p.status} → ${c.status}`);
  }
  for (const d of next.disagreements) {
    const p = prev.disagreements.find((x) => x.id === d.id) ?? prev.disagreements.find((x) => sameTitle(x.topic, d.topic));
    if (d.resolution && !(p && p.resolution)) lines.push(`Decision recorded by ${d.resolution.by}: ${d.resolution.adopted}`);
    if (!p && !d.resolution) lines.push(`New disagreement: ${d.topic}`);
  }
  const match = (b: { id: string; title: string }, list: PilotAnalysis["blockers"]) => list.find((x) => x.id === b.id) ?? list.find((x) => sameTitle(x.title, b.title));
  let resolved = 0;
  for (const b of next.blockers) {
    const p = match(b, prev.blockers);
    if (!p) lines.push(`New blocker: ${b.title}`);
    else if (p.state !== "resolved" && b.state === "resolved") {
      resolved++;
      lines.push(`Blocker resolved: ${b.title}`);
    } else if (p.state !== b.state) lines.push(`Blocker "${b.title}": ${p.state.replace("_", " ")} → ${b.state.replace("_", " ")}`);
  }
  for (const p of prev.blockers) if (!match(p, next.blockers)) lines.push(`Blocker no longer raised: ${p.title}`);
  const conf = (a: PilotAnalysis) => a.findings.filter((f) => f.status === "confirmed").length;
  if (conf(prev) !== conf(next)) lines.push(`Confirmed facts: ${conf(prev)} → ${conf(next)}`);
  if (prev.readinessStage !== next.readinessStage) lines.unshift(`Stage: ${stageLabel(prev.readinessStage)} → ${stageLabel(next.readinessStage)}`);
  if (resolved > 1) lines.unshift(`${resolved} blockers resolved`);
  if (!lines.length && prev.completenessScore === next.completenessScore) lines.push("No material change since the previous run.");
  return { fromVersion, toVersion, scoreFrom: prev.completenessScore, scoreTo: next.completenessScore, stageFrom: prev.readinessStage, stageTo: next.readinessStage, lines: lines.slice(0, 14) };
}

/* ---------- Prompt-injection flagging (display only; the rules never depend on it) ---------- */

const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above|earlier) (instructions|rules)/i,
  /disregard (all |any |the )?(previous|prior|above|system) (instructions|rules)/i,
  /^\s*system\s*:/im,
  /you are now\b/i,
  /override (the )?(system|grounding) (prompt|rules)/i,
  /mark (this|the) (opportunity|deal) (as )?ready/i,
];
export function detectInjection(texts: string[]): string[] {
  const hits: string[] = [];
  for (const t of texts)
    for (const line of t.split(/\r?\n/)) if (INJECTION_PATTERNS.some((p) => p.test(line))) hits.push(line.trim().slice(0, 160));
  return [...new Set(hits)].slice(0, 5);
}

/* ---------- Entry point (mock: fixtures only, no model is called) ---------- */

export type AnalyzeResult = { analysis: PilotAnalysis; mode: "demo_fixture"; model: string };

export function analyze(args: { opp: Opportunity; docs: SourceDoc[]; facts: Fact[]; prev: PilotAnalysis | null }): AnalyzeResult {
  const { opp, docs, facts, prev } = args;
  const sources = buildSources(opp, docs, facts, prev);
  const fixture = opp.fixtureKey ? FIXTURES[opp.fixtureKey] : undefined;
  const base = fixture ? fixture() : genericFixture(opp.useCase);
  return { analysis: applyGuards(carryForward(base, prev, facts, true), sources), mode: "demo_fixture", model: fixture ? `fixture:${opp.fixtureKey}` : "fixture:generic-checklist" };
}
