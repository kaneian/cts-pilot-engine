import { z } from "zod";
import { at, audit, emptyDb, now, readDb, uid, writeDb, type DB, type RunRow } from "./db";
import { analyze, detectInjection, diffRuns, normalize } from "./analysis";
import { generateBrief } from "./brief";
import { CEDAR_NOTES, DEMO_TEMPLATE, DEMO_TEMPLATE_NAME, FALCON_NOTES, HARBORLIGHT_NOTES, LAKESHORE_NOTES, NORTHSTAR_NOTES, SEED_ATTENDEES_CSV } from "./demo-data";
import { knowledgeMeta } from "./knowledge";
import { isCommercialField, populateTemplate, templateFields } from "./mou";
import { guessUseCase, parseCsv, promoteNotes, scoreInstitution } from "./pipeline";
import { ROLE_KEYS, STAGE_KEYS, USE_CASES, roleLabel, type Bundle, type Institution, type LlmStatus, type Opportunity, type PilotAnalysis, type RunSummary, type SourceDoc } from "./types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const MOCK: LlmStatus = { configured: false, provider: "none", model: "", briefModel: "", passes: "multi" };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/* ---------- load / commit ---------- */

function load(): DB {
  const db = readDb();
  if (db) return db;
  const fresh = seed(emptyDb());
  writeDb(fresh);
  return fresh;
}

/** Runs a mutation against a fresh copy and saves only if it does not throw. */
function commit<T>(fn: (db: DB) => T): T {
  const db = load();
  const out = fn(db);
  writeDb(db);
  return out;
}

/* ---------- reads ---------- */

function findOpp(db: DB, id: string): Opportunity {
  const o = db.opportunities.find((x) => x.id === id);
  if (!o) throw new HttpError(404, "Opportunity not found.");
  return o;
}
const docsOf = (db: DB, id: string) => db.docs.filter((d) => d.opportunityId === id);
const factsOf = (db: DB, id: string) => db.facts.filter((f) => f.opportunityId === id);
const latestRun = (db: DB, id: string): RunRow | undefined => db.runs.filter((r) => r.opportunityId === id).sort((a, b) => b.version - a.version)[0];
const summary = (r: RunRow): RunSummary => ({ id: r.id, version: r.version, mode: r.mode, model: r.model, createdBy: r.createdBy, createdAt: r.createdAt, durationMs: 0, score: r.state.completenessScore, stage: r.state.readinessStage, diff: r.diff });

function bundle(db: DB, id: string): Bundle {
  const opportunity = findOpp(db, id);
  const runs = db.runs.filter((r) => r.opportunityId === id).sort((a, b) => b.version - a.version);
  const docs = docsOf(db, id);
  const byNewest = <T extends { createdAt: string }>(a: T, b: T) => (a.createdAt < b.createdAt ? 1 : -1);
  return clone({
    opportunity,
    docs,
    runs: runs.map(summary),
    current: runs[0] ? { ...summary(runs[0]), state: runs[0].state, stateVersion: 0 } : null,
    facts: factsOf(db, id),
    comments: db.comments.filter((c) => c.opportunityId === id).sort(byNewest),
    audit: db.audit.filter((a) => a.opportunityId === id).sort((a, b) => b.seq - a.seq).slice(0, 200),
    briefs: db.briefs.filter((b) => b.opportunityId === id).sort((a, b) => b.revision - a.revision),
    mou: db.mous.filter((m) => m.opportunityId === id).sort(byNewest)[0] ?? null,
    knowledge: knowledgeMeta(),
    llm: MOCK,
    injectionFlags: detectInjection([opportunity.notes, ...docs.map((x) => x.content)]),
  });
}
export const getBundle = (id: string) => bundle(load(), id);

export type OppListItem = Opportunity & { score: number | null; readinessStage: string | null; openBlockers: number; openHigh: number; openDisagreements: number; pendingReviews: number; hasBrief: boolean; hasMou: boolean; mode: string | null; criteria: { key: string; status: string }[] };

function listItems(db: DB): OppListItem[] {
  return [...db.opportunities]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((o) => {
      const st = latestRun(db, o.id)?.state ?? null;
      const open = st ? st.blockers.filter((b) => b.state === "open" || b.state === "in_review") : [];
      return {
        ...o,
        notes: "",
        score: st?.completenessScore ?? null,
        readinessStage: st?.readinessStage ?? null,
        openBlockers: open.length,
        openHigh: open.filter((b) => b.priority === "high").length,
        openDisagreements: st ? st.disagreements.filter((x) => !x.resolution).length : 0,
        pendingReviews: st ? st.findings.filter((f) => !f.review || f.review.state === "needs_evidence").length : 0,
        hasBrief: db.briefs.some((b) => b.opportunityId === o.id),
        hasMou: db.mous.some((m) => m.opportunityId === o.id),
        mode: st ? "demo_fixture" : null,
        criteria: st ? st.criteria.map((c) => ({ key: c.key, status: c.status })) : [],
      };
    });
}
export const listOpportunities = () => listItems(load());

export function dashboard() {
  const db = load();
  const opportunities = listItems(db);
  const states = db.opportunities.map((o) => latestRun(db, o.id)?.state).filter((s): s is PilotAnalysis => !!s);
  const openBlockers = states.flatMap((s) => s.blockers.filter((b) => b.state === "open" || b.state === "in_review"));
  const names = new Map(db.opportunities.map((o) => [o.id, o.name]));
  return clone({
    opportunities,
    cards: {
      opportunities: opportunities.length,
      analyzed: states.length,
      openHighBlockers: opportunities.reduce((n, o) => n + o.openHigh, 0),
      pendingReviews: opportunities.reduce((n, o) => n + o.pendingReviews, 0),
      openDisagreements: opportunities.reduce((n, o) => n + o.openDisagreements, 0),
      briefs: new Set(db.briefs.map((b) => b.opportunityId)).size,
      mous: new Set(db.mous.map((b) => b.opportunityId)).size,
      avgScore: states.length ? Math.round(states.reduce((n, s) => n + s.completenessScore, 0) / states.length) : null,
    },
    blockersByOwner: ROLE_KEYS.map((k) => ({ role: k, open: openBlockers.filter((b) => b.ownerRole === k).length, high: openBlockers.filter((b) => b.ownerRole === k && b.priority === "high").length })),
    value: {
      blockersSurfaced: states.reduce((n, s) => n + s.blockers.length, 0),
      ownersAssigned: states.reduce((n, s) => n + s.blockers.filter((b) => b.ownerRole).length, 0),
      decisionsRecorded: states.reduce((n, s) => n + s.disagreements.filter((x) => x.resolution).length, 0),
      findingReviews: db.audit.filter((a) => a.action === "Reviewed finding").length,
      documentsProduced: new Set(db.briefs.map((b) => b.opportunityId)).size + new Set(db.mous.map((b) => b.opportunityId)).size,
      analysisRuns: db.runs.length,
    },
    activity: [...db.audit].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.seq - a.seq)).slice(0, 8).map((a) => ({ ...a, opportunityName: names.get(a.opportunityId) ?? "" })),
    knowledge: knowledgeMeta(),
    pipelineCount: db.institutions.filter((i) => i.isFi && !i.promotedOpportunityId).length,
    seededAt: db.seededAt,
  });
}
export type Dashboard = ReturnType<typeof dashboard>;

/* ---------- validation helpers ---------- */

const Actor = z.enum(ROLE_KEYS);
const MAX_UPLOAD = 200_000;
function checkUpload(name: string, content: string) {
  if (!/\.(md|txt|markdown)$/i.test(name)) throw new HttpError(400, "Only .txt and .md files are accepted.");
  if (content.length > MAX_UPLOAD) throw new HttpError(400, "That file is too large. The limit is 200 KB of text.");
  if (content.includes("\u0000")) throw new HttpError(400, "That file does not look like plain text.");
}

/* ---------- opportunity writes ---------- */

export const CreateOpp = z.object({
  name: z.string().trim().min(2, "Give the opportunity a name.").max(120),
  ownerRole: Actor,
  stage: z.enum(STAGE_KEYS).default("discovery"),
  useCase: z.enum(USE_CASES),
  notes: z.string().max(60_000).default(""),
  docs: z.array(z.object({ name: z.string().max(200), content: z.string() })).max(5).default([]),
  actor: Actor,
});

function insertOpp(db: DB, input: z.infer<typeof CreateOpp>, extra?: { fictional?: boolean; fixtureKey?: string; source?: string }): Opportunity {
  for (const d of input.docs) checkUpload(d.name, d.content);
  const t = now();
  const who = roleLabel(input.actor);
  const o: Opportunity = { id: uid(), name: input.name, ownerRole: input.ownerRole, stage: input.stage, useCase: input.useCase, notes: input.notes, fictional: !!extra?.fictional, fixtureKey: extra?.fixtureKey ?? null, source: extra?.source ?? null, version: 1, lastEditedBy: who, createdAt: t, updatedAt: t };
  db.opportunities.push(o);
  for (const d of input.docs) db.docs.push({ id: uid(), opportunityId: o.id, name: d.name, kind: "reference", content: d.content, approval: "unapproved", approvedBy: null, approvedOn: null, uploadedBy: who, createdAt: t });
  audit(db, o.id, who, "Created opportunity", input.name);
  return o;
}
export const createOpportunity = (input: z.infer<typeof CreateOpp>) => commit((db) => clone(insertOpp(db, input, { fictional: true, source: "Created in the demo" })));

export const PatchOpp = z.object({ actor: Actor, expectedVersion: z.number().int(), notes: z.string().max(60_000).optional() });

export function updateOpportunity(id: string, p: z.infer<typeof PatchOpp>): Bundle {
  return commit((db) => {
    const cur = findOpp(db, id);
    if (cur.version !== p.expectedVersion) throw new HttpError(409, `${cur.lastEditedBy ?? "Someone"} saved changes while you were editing. Your edit was not saved. Copy your text, reload the latest version, then re-apply it.`);
    const changed = p.notes !== undefined && p.notes !== cur.notes;
    if (p.notes !== undefined) cur.notes = p.notes;
    cur.version++;
    cur.lastEditedBy = roleLabel(p.actor);
    cur.updatedAt = now();
    audit(db, id, roleLabel(p.actor), "Edited opportunity", changed ? "discovery notes" : "no changes");
    return bundle(db, id);
  });
}

const touch = (db: DB, id: string) => {
  findOpp(db, id).updatedAt = now();
};

/* ---------- analysis ---------- */

function runAnalysisIn(db: DB, id: string, actorKey: string) {
  const actor = roleLabel(Actor.parse(actorKey));
  const opp = findOpp(db, id);
  const prev = latestRun(db, id);
  const res = analyze({ opp, docs: docsOf(db, id), facts: factsOf(db, id), prev: prev?.state ?? null });
  const version = prev ? prev.version + 1 : 1;
  const diff = prev ? diffRuns(prev.output, res.analysis, prev.version, version) : null;
  db.runs.push({ id: uid(), opportunityId: id, version, mode: "demo_fixture", model: res.model, output: clone(res.analysis), state: clone(res.analysis), diff, createdBy: actor, createdAt: now() });
  opp.stage = res.analysis.readinessStage;
  opp.updatedAt = now();
  audit(db, id, actor, version === 1 ? "Ran analysis" : "Re-ran analysis", `v${version} · mock fixture, no model called · completeness ${res.analysis.completenessScore}/100`);
}
export const runAnalysis = (id: string, actorKey: string) =>
  commit((db) => {
    runAnalysisIn(db, id, actorKey);
    return bundle(db, id);
  });

function mutateState(db: DB, id: string, fn: (s: PilotAnalysis) => void) {
  const run = latestRun(db, id);
  if (!run) throw new HttpError(400, "Run an analysis first.");
  fn(run.state);
  run.state = normalize(run.state);
  touch(db, id);
}

/* ---------- actions ---------- */

const Base = { actor: Actor };
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ ...Base, type: z.literal("reviewFinding"), findingId: z.string(), state: z.enum(["approved", "rejected", "needs_evidence"]), rationale: z.string().max(1000).optional() }),
  z.object({
    ...Base,
    type: z.literal("updateBlocker"),
    blockerId: z.string(),
    baseEditedAt: z.string().default(""),
    patch: z.object({
      ownerRole: Actor.optional(),
      recommendedAction: z.string().max(600).optional(),
      deadline: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date.").optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
      state: z.enum(["open", "in_review", "resolved", "deferred"]).optional(),
    }),
  }),
  z.object({ ...Base, type: z.literal("resolveDisagreement"), disagreementId: z.string(), adopted: z.string().trim().min(5, "Say what is being adopted.").max(800), rationale: z.string().trim().min(5, "A rationale is required.").max(1000) }),
  z.object({ ...Base, type: z.literal("endorseResolution"), disagreementId: z.string() }),
  z.object({ ...Base, type: z.literal("reopenDisagreement"), disagreementId: z.string(), rationale: z.string().trim().min(5, "Say why this is being reopened.").max(1000) }),
  z.object({ ...Base, type: z.literal("addComment"), targetType: z.enum(["finding", "blocker", "disagreement", "opportunity", "brief"]), targetId: z.string().max(80), targetLabel: z.string().max(200).default(""), body: z.string().trim().min(1).max(2000) }),
  z.object({ ...Base, type: z.literal("addFact"), text: z.string().trim().min(2).max(600), field: z.string().max(60).optional() }),
  z.object({ ...Base, type: z.literal("addDoc"), name: z.string().trim().min(1).max(200), kind: z.enum(["reference", "template", "deal_file"]), content: z.string().min(1) }),
  z.object({ ...Base, type: z.literal("loadDemoTemplate") }),
  z.object({ ...Base, type: z.literal("setDocApproval"), docId: z.string(), approved: z.boolean() }),
  z.object({ ...Base, type: z.literal("generateBrief") }),
  z.object({ ...Base, type: z.literal("saveBrief"), content: z.string().min(1).max(100_000), baseRevision: z.number().int() }),
  z.object({ ...Base, type: z.literal("generateMou") }),
]);
export type Action = z.infer<typeof ActionSchema>;

function applyAction(db: DB, id: string, a: Action): string | undefined {
  const opp = findOpp(db, id);
  const who = roleLabel(a.actor);
  const t = now();
  const addDoc = (name: string, kind: SourceDoc["kind"], content: string) => db.docs.push({ id: uid(), opportunityId: id, name, kind, content, approval: "unapproved", approvedBy: null, approvedOn: null, uploadedBy: who, createdAt: t });

  switch (a.type) {
    case "reviewFinding":
      mutateState(db, id, (s) => {
        const f = s.findings.find((x) => x.id === a.findingId);
        if (!f) throw new HttpError(404, "That finding no longer exists. Reload to see the latest analysis.");
        f.review = { state: a.state, by: who, rationale: a.rationale?.trim() || undefined, at: t };
        audit(db, id, who, "Reviewed finding", `${a.state.replace("_", " ")}: "${f.title}"${a.rationale ? ` — ${a.rationale}` : ""}`);
      });
      return;

    case "updateBlocker":
      mutateState(db, id, (s) => {
        const b = s.blockers.find((x) => x.id === a.blockerId);
        if (!b) throw new HttpError(404, "That blocker no longer exists. Reload to see the latest analysis.");
        if ((b.lastEditedAt ?? "") !== a.baseEditedAt) throw new HttpError(409, `${b.lastEditedBy ?? "Someone"} edited this blocker while you had it open. Your change was not saved. Review their version and try again.`);
        const before = { ...b };
        if (a.patch.ownerRole) b.ownerRole = a.patch.ownerRole;
        if (a.patch.recommendedAction !== undefined) b.recommendedAction = a.patch.recommendedAction;
        if (a.patch.deadline !== undefined) b.deadline = a.patch.deadline || undefined;
        if (a.patch.priority) b.priority = a.patch.priority;
        if (a.patch.state) b.state = a.patch.state;
        b.lastEditedBy = who;
        b.lastEditedAt = t;
        const ch = (["ownerRole", "priority", "state", "deadline", "recommendedAction"] as const)
          .filter((k) => before[k] !== b[k])
          .map((k) => (k === "recommendedAction" ? "next action edited" : `${k === "ownerRole" ? "owner" : k}: ${before[k] ?? "none"} → ${b[k] ?? "none"}`));
        audit(db, id, who, "Updated blocker", `"${b.title}" — ${ch.join("; ") || "no change"}`);
      });
      return;

    case "resolveDisagreement":
      mutateState(db, id, (s) => {
        const d = s.disagreements.find((x) => x.id === a.disagreementId);
        if (!d) throw new HttpError(404, "That disagreement no longer exists. Reload to see the latest analysis.");
        if (d.resolution) throw new HttpError(409, `${d.resolution.by} already resolved this. Reopen it first if the decision should change.`);
        d.resolution = { adopted: a.adopted, by: who, rationale: a.rationale, at: t, approvals: [] };
        d.resolutionStatus = "resolved";
        audit(db, id, who, "Resolved disagreement", `"${d.topic}" — adopted: ${a.adopted} Rationale: ${a.rationale}`);
      });
      return;

    case "endorseResolution":
      mutateState(db, id, (s) => {
        const d = s.disagreements.find((x) => x.id === a.disagreementId);
        if (!d?.resolution) throw new HttpError(400, "There is no recorded decision to approve yet.");
        if (d.resolution.by === who) throw new HttpError(400, "The person who made the decision cannot also approve it. Switch role.");
        d.resolution.approvals = d.resolution.approvals ?? [];
        if (d.resolution.approvals.some((x) => x.by === who)) throw new HttpError(400, "You have already approved this decision.");
        d.resolution.approvals.push({ by: who, at: t });
        audit(db, id, who, "Approved decision", `"${d.topic}" — ${d.resolution.adopted}`);
      });
      return;

    case "reopenDisagreement":
      mutateState(db, id, (s) => {
        const d = s.disagreements.find((x) => x.id === a.disagreementId);
        if (!d?.resolution) throw new HttpError(400, "This disagreement is already open.");
        audit(db, id, who, "Reopened disagreement", `"${d.topic}" — previous decision by ${d.resolution.by}: ${d.resolution.adopted} Reason: ${a.rationale}`);
        d.resolution = undefined;
        d.resolutionStatus = "open";
      });
      return;

    case "addComment":
      db.comments.push({ id: uid(), opportunityId: id, targetType: a.targetType, targetId: a.targetId, targetLabel: a.targetLabel, role: who, body: a.body, createdAt: t });
      audit(db, id, who, "Commented", `${a.targetLabel ? `on "${a.targetLabel}": ` : ""}${a.body.slice(0, 200)}`);
      touch(db, id);
      return;

    case "addFact": {
      const field = a.field ? a.field.toUpperCase() : null;
      if (field && isCommercialField(field) && a.actor !== "commercial") throw new HttpError(403, "Commercial terms can only be confirmed in the Commercial role. Switch role to confirm this term.");
      if (field) db.facts = db.facts.filter((f) => !(f.opportunityId === id && f.field === field));
      db.facts.push({ id: uid(), opportunityId: id, text: a.text, field, by: who, createdAt: t });
      audit(db, id, who, field ? "Confirmed agreement term" : "Added confirmed fact", field ? `${field}: ${a.text}` : a.text);
      touch(db, id);
      return;
    }

    case "addDoc":
      checkUpload(a.name, a.content);
      addDoc(a.name, a.kind, a.content);
      audit(db, id, who, a.kind === "template" ? "Uploaded template" : "Uploaded document", `${a.name} (not approved)`);
      touch(db, id);
      return;

    case "loadDemoTemplate":
      addDoc(DEMO_TEMPLATE_NAME, "template", DEMO_TEMPLATE);
      audit(db, id, who, "Uploaded template", `${DEMO_TEMPLATE_NAME} (fictional demo template, not approved)`);
      touch(db, id);
      return;

    case "setDocApproval": {
      const doc = db.docs.find((d) => d.id === a.docId && d.opportunityId === id);
      if (!doc) throw new HttpError(404, "Document not found.");
      if (doc.kind === "template" && a.actor !== "legal") throw new HttpError(403, "Only the Legal role can approve or unapprove an agreement template. Switch role to Legal.");
      // A document that declares itself fictional can only ever be approved for demo use.
      const fictional = /FICTIONAL|DEMO ONLY|NOT AN APPROVED/i.test(doc.content.slice(0, 600));
      doc.approval = !a.approved ? "unapproved" : fictional ? "demo_only" : "approved";
      doc.approvedBy = a.approved ? who : null;
      doc.approvedOn = a.approved ? t.slice(0, 10) : null;
      audit(db, id, who, a.approved ? "Approved document" : "Removed document approval", `${doc.name}${doc.approval === "demo_only" ? " (demo use only: document is marked fictional)" : ""}`);
      touch(db, id);
      return;
    }

    case "generateBrief": {
      const run = latestRun(db, id);
      if (!run) throw new HttpError(400, "Run an analysis first. The brief is built from the reviewed analysis.");
      const res = generateBrief(opp, run.state);
      const rev = Math.max(0, ...db.briefs.filter((b) => b.opportunityId === id).map((b) => b.revision)) + 1;
      db.briefs.push({ id: uid(), opportunityId: id, revision: rev, content: res.content, mode: res.mode, model: res.model, by: who, createdAt: t });
      audit(db, id, who, "Generated pilot brief", `revision ${rev} · assembled from the reviewed analysis`);
      touch(db, id);
      return;
    }

    case "saveBrief": {
      const cur = db.briefs.filter((b) => b.opportunityId === id).sort((x, y) => y.revision - x.revision)[0];
      if (!cur) throw new HttpError(400, "Generate a brief before editing it.");
      if (cur.revision !== a.baseRevision) throw new HttpError(409, `${cur.by} saved revision ${cur.revision} while you were editing. Your edit was not saved. Copy your text, load the latest revision, then re-apply it.`);
      db.briefs.push({ id: uid(), opportunityId: id, revision: cur.revision + 1, content: a.content, mode: "human_edit", model: "", by: who, createdAt: t });
      audit(db, id, who, "Edited pilot brief", `saved revision ${cur.revision + 1}`);
      touch(db, id);
      return;
    }

    case "generateMou": {
      const tpl = docsOf(db, id)
        .filter((d) => d.kind === "template" && (d.approval === "approved" || d.approval === "demo_only"))
        .pop();
      if (!tpl) throw new HttpError(400, "Upload an approved template to generate a populated agreement.");
      const res = populateTemplate({ template: tpl, opp, analysis: latestRun(db, id)?.state ?? null, facts: factsOf(db, id) });
      db.mous.push({ id: uid(), opportunityId: id, templateId: tpl.id, templateName: tpl.name, templateApproval: tpl.approval, segments: res.segments, mode: res.mode, by: who, createdAt: t });
      const missing = new Set(res.segments.filter((s) => s.t === "missing").map((s) => (s as { key: string }).key)).size;
      audit(db, id, who, "Generated agreement draft", `from "${tpl.name}" · ${res.segments.filter((s) => s.t === "ins").length} values inserted, ${missing} terms [TO CONFIRM] · not legal advice`);
      touch(db, id);
      return templateFields(tpl.content).length ? undefined : "This template has no {{PLACEHOLDER}} fields, so nothing was inserted. The clauses are shown unchanged.";
    }
  }
}

export const runAction = (id: string, a: Action): { bundle: Bundle; note?: string } =>
  commit((db) => {
    const note = applyAction(db, id, a);
    return { bundle: bundle(db, id), note };
  });

/* ---------- mock seed ---------- */

const day = (plus: number) => new Date(Date.now() + plus * 86_400_000).toISOString().slice(0, 10);
const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();

function seed(db: DB): DB {
  db.seededAt = new Date().toISOString();
  const mk = (when: string, name: string, useCase: (typeof USE_CASES)[number], notes: string, fixtureKey: string, ownerRole: (typeof ROLE_KEYS)[number] = "partnerships") =>
    at(when, () => insertOpp(db, { name: `${name} (FICTIONAL)`, ownerRole, stage: "discovery", useCase, notes, docs: [], actor: "partnerships" }, { fictional: true, fixtureKey, source: "Seeded mock data" }));
  const act = (when: string, id: string, a: Record<string, unknown>) => at(when, () => applyAction(db, id, ActionSchema.parse(a)));

  // Pre-analyzed, with back-dated mock history.
  const h = mk(ago(9), "Harborlight Community Bank", "Tokenized deposits", HARBORLIGHT_NOTES, "harborlight");
  at(ago(8, 20), () => runAnalysisIn(db, h.id, "partnerships"));
  act(ago(8), h.id, { type: "reviewFinding", actor: "commercial", findingId: "f-budget", state: "approved" });
  act(ago(7, 22), h.id, { type: "reviewFinding", actor: "commercial", findingId: "f-kpis", state: "approved" });
  act(ago(7, 3), h.id, { type: "reviewFinding", actor: "product", findingId: "f-capability", state: "needs_evidence", rationale: "Needs an approved capability reference before it goes in a brief." });
  act(ago(6, 5), h.id, { type: "resolveDisagreement", actor: "product", disagreementId: "d-clients", adopted: "Phase one: the two named commercial clients, on-us transfers only. Add a third client only after the first month's results.", rationale: "The bank asked to start with two, and a third adds onboarding before anything is proven." });
  act(ago(6, 1), h.id, { type: "endorseResolution", actor: "commercial", disagreementId: "d-clients" });
  act(ago(5, 6), h.id, { type: "updateBlocker", actor: "legal", blockerId: "b-vendor-risk", baseEditedAt: "", patch: { state: "in_review", deadline: day(6) } });
  act(ago(5, 4), h.id, { type: "updateBlocker", actor: "engineering", blockerId: "b-integration", baseEditedAt: "", patch: { state: "in_review", deadline: day(9) } });
  at(ago(5), () => runAnalysisIn(db, h.id, "partnerships"));
  act(ago(4, 2), h.id, { type: "addComment", actor: "engineering", targetType: "opportunity", targetId: h.id, body: "Core team intro call is booked. I'll document the integration approach after it." });
  act(ago(3), h.id, { type: "generateBrief", actor: "partnerships" });

  const f = mk(ago(4), "Falcon Ridge Bank", "Interoperability", FALCON_NOTES, "falcon", "commercial");
  at(ago(3, 20), () => runAnalysisIn(db, f.id, "partnerships"));
  act(ago(3, 2), f.id, { type: "reviewFinding", actor: "engineering", findingId: "f-connect", state: "needs_evidence", rationale: "We need details of their proof of concept before saying anything about connecting." });
  act(ago(2, 8), f.id, { type: "updateBlocker", actor: "legal", blockerId: "b-nda", baseEditedAt: "", patch: { state: "in_review", deadline: day(4) } });
  act(ago(2, 4), f.id, { type: "addComment", actor: "legal", targetType: "opportunity", targetId: f.id, body: "NDA sent to their counsel." });

  const c = mk(ago(1, 6), "Cedar Ridge Federal Credit Union", "Treasury sweeps", CEDAR_NOTES, "cedar");
  at(ago(1, 5), () => runAnalysisIn(db, c.id, "partnerships"));

  // Left un-analyzed so the walkthrough can start from the notes.
  mk(ago(0, 3), "Lakeshore Credit Union", "Programmable escrow", LAKESHORE_NOTES, "lakeshore");
  mk(ago(0, 1), "Northstar Regional Bank", "24/7 settlement", NORTHSTAR_NOTES, "northstar");
  return db;
}

/** Replaces everything with the original mock data set. */
export function resetDemo() {
  const db = seed(emptyDb());
  writeDb(db);
  return { northstar: db.opportunities.find((o) => o.fixtureKey === "northstar")!.id, lakeshore: db.opportunities.find((o) => o.fixtureKey === "lakeshore")!.id };
}

/* ---------- pipeline intake ---------- */

const sortInst = (list: Institution[]) => [...list].sort((a, b) => Number(b.isFi) - Number(a.isFi) || b.score - a.score || a.name.localeCompare(b.name));
export const listInstitutions = () => clone(sortInst(load().institutions));

export function importCsv(fileName: string, text: string, batchLabel?: string) {
  if (!/\.csv$/i.test(fileName)) throw new HttpError(400, "Upload a .csv file.");
  if (text.length > 1_000_000) throw new HttpError(400, "That CSV is too large. The limit is 1 MB.");
  const rows = parseCsv(text);
  if (!rows.length) throw new HttpError(400, "No rows found. The first line must be a header row with an 'institution' column.");
  const batch = batchLabel ?? fileName;
  return commit((db) => {
    // Re-importing replaces the list. Links to already-promoted opportunities are kept by institution name.
    const promoted = new Map(db.institutions.filter((i) => i.promotedOpportunityId).map((i) => [i.name, i.promotedOpportunityId]));
    db.institutions = rows.map((r, i) => {
      const s = scoreInstitution(r, i + 2, fileName);
      const oid = promoted.get(s.name) ?? null;
      return { id: uid(), batch, rowNumber: i + 2, name: s.name, isFi: s.isFi, score: s.score, data: s.data, breakdown: s.breakdown, promotedOpportunityId: oid && db.opportunities.some((o) => o.id === oid) ? oid : null, createdAt: now() };
    });
    return clone(sortInst(db.institutions));
  });
}
export const importSeedCsv = () => importCsv("attendees.csv", SEED_ATTENDEES_CSV, "attendees.csv (FICTIONAL mock list)");

export function promoteInstitution(instId: string, actorKey: string) {
  const actor = Actor.parse(actorKey);
  return commit((db) => {
    const inst = db.institutions.find((i) => i.id === instId);
    if (!inst) throw new HttpError(404, "Institution not found.");
    if (!inst.isFi) throw new HttpError(400, "This row is not a bank or credit union, so it cannot be promoted.");
    if (inst.promotedOpportunityId && db.opportunities.some((o) => o.id === inst.promotedOpportunityId)) return { opportunityId: inst.promotedOpportunityId };
    const name = /fictional/i.test(inst.name) ? inst.name : `${inst.name} (FICTIONAL)`;
    const opp = insertOpp(db, { name, ownerRole: "partnerships", stage: "discovery", useCase: guessUseCase(inst) as (typeof USE_CASES)[number], notes: promoteNotes(inst), docs: [], actor }, { fictional: true, source: `Pipeline Intake: ${inst.batch}` });
    inst.promotedOpportunityId = opp.id;
    audit(db, opp.id, roleLabel(actor), "Promoted from pipeline", `${inst.name} · qualification score ${inst.score}/100`);
    return { opportunityId: opp.id };
  });
}
