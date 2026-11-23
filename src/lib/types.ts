import { z } from "zod";

/* ---------- Shared constants (safe to import from client components) ---------- */

export const ROLES = [
  { key: "partnerships", label: "Ian · Partnerships", short: "Partnerships" },
  { key: "commercial", label: "Eran · Commercial", short: "Commercial" },
  { key: "product", label: "Product", short: "Product" },
  { key: "engineering", label: "Engineering", short: "Engineering" },
  { key: "legal", label: "Legal", short: "Legal" },
] as const;
export type RoleKey = (typeof ROLES)[number]["key"];
export const ROLE_KEYS = ROLES.map((r) => r.key) as [RoleKey, ...RoleKey[]];
export const roleLabel = (k: string) => ROLES.find((r) => r.key === k)?.label ?? k;
export const roleShort = (k: string) => ROLES.find((r) => r.key === k)?.short ?? k;

export const USE_CASES = [
  "Tokenized deposits",
  "Treasury sweeps",
  "Programmable escrow",
  "24/7 settlement",
  "Collateral mobility",
  "Interoperability",
  "Other",
] as const;

export const STAGES = [
  { key: "discovery", label: "Discovery" },
  { key: "needs_validation", label: "Needs validation" },
  { key: "pilot_scoping", label: "Pilot scoping" },
  { key: "pending_internal_approval", label: "Pending internal approval" },
  { key: "ready_for_customer_review", label: "Ready for customer review" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((s) => s.key) as [StageKey, ...StageKey[]];
export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k;

export const CRITERIA = [
  { key: "business_objective", label: "Business objective" },
  { key: "sponsor", label: "Sponsor" },
  { key: "budget_owner", label: "Budget owner" },
  { key: "use_case", label: "Use case" },
  { key: "economics_baseline", label: "Economics / baseline" },
  { key: "technical_feasibility", label: "Technical feasibility" },
  { key: "kpis", label: "KPIs" },
  { key: "phase_one_scope", label: "Phase-one scope" },
  { key: "commercial_terms", label: "Commercial terms" },
  { key: "legal_process", label: "Legal process" },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];
export const CRITERION_KEYS = CRITERIA.map((c) => c.key) as [CriterionKey, ...CriterionKey[]];
export const criterionLabel = (k: string) => CRITERIA.find((c) => c.key === k)?.label ?? k;

/* ---------- Output contract (section 6 of the build prompt) ---------- */

const str = (max: number) =>
  z
    .string()
    .transform((s) => (s.length > max ? s.slice(0, max) + "…" : s));

export const EvidenceSchema = z.object({
  sourceId: z.string().optional(),
  sourceName: str(200).catch("Unspecified source"),
  excerpt: str(600).optional(),
  evidenceStatus: z.enum(["supported", "unverified", "contradictory"]).catch("unverified"),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ReviewSchema = z.object({
  state: z.enum(["approved", "rejected", "needs_evidence"]),
  by: z.string(),
  rationale: z.string().optional(),
  at: z.string(),
});

export const FindingSchema = z.object({
  id: z.string(),
  title: str(200),
  description: str(1200).catch(""),
  category: z.enum(["commercial", "product", "technical", "legal"]).catch("commercial"),
  status: z.enum(["confirmed", "assumption", "unknown"]).catch("unknown"),
  evidence: z.array(EvidenceSchema).catch([]),
  followUpQuestion: str(400).optional(),
  review: ReviewSchema.optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const BlockerSchema = z.object({
  id: z.string(),
  title: str(200),
  whyItMatters: str(800).catch(""),
  priority: z.enum(["high", "medium", "low"]).catch("medium"),
  ownerRole: z.enum(ROLE_KEYS).catch("partnerships"),
  recommendedAction: str(600).catch(""),
  openQuestion: str(400).catch(""),
  deadline: z.string().optional(),
  evidence: z.array(EvidenceSchema).catch([]),
  state: z.enum(["open", "in_review", "resolved", "deferred"]).catch("open"),
  criterion: z.enum(CRITERION_KEYS).optional().catch(undefined),
  lastEditedBy: z.string().optional(),
  lastEditedAt: z.string().optional(),
});
export type Blocker = z.infer<typeof BlockerSchema>;

export const DisagreementSchema = z.object({
  id: z.string(),
  topic: str(200),
  positions: z.array(z.object({ reviewer: str(80), position: str(800) })).catch([]),
  proposedResolution: str(800).catch(""),
  resolution: z
    .object({
      adopted: z.string(),
      by: z.string(),
      rationale: z.string(),
      at: z.string(),
      approvals: z.array(z.object({ by: z.string(), at: z.string() })).optional(),
    })
    .optional(),
  resolutionStatus: z.enum(["open", "resolved"]).catch("open"),
  criterion: z.enum(CRITERION_KEYS).optional().catch(undefined),
  blockerIds: z.array(z.string()).optional().catch(undefined),
});
export type Disagreement = z.infer<typeof DisagreementSchema>;

export const CriterionAssessmentSchema = z.object({
  key: z.enum(CRITERION_KEYS),
  status: z.enum(["met", "partial", "missing"]).catch("missing"),
  note: str(400).catch(""),
});
export type CriterionAssessment = z.infer<typeof CriterionAssessmentSchema>;

export const PilotAnalysisSchema = z.object({
  readinessStage: z.enum(STAGE_KEYS).catch("discovery"),
  completenessScore: z.number().catch(0),
  scoringRationale: str(1500).catch(""),
  executiveSummary: str(2500).catch(""),
  criteria: z.array(CriterionAssessmentSchema).catch([]),
  findings: z.array(FindingSchema).max(40).catch([]),
  blockers: z.array(BlockerSchema).max(25).catch([]),
  disagreements: z.array(DisagreementSchema).max(12).catch([]),
  proposedMilestones: z
    .array(z.object({ title: str(200), ownerRole: str(60).catch("partnerships"), exitCriteria: str(400).catch("") }))
    .max(12)
    .catch([]),
  proposedKpis: z
    .array(z.object({ name: str(200), measurement: str(400).catch(""), baselineStatus: str(300).catch("Unknown") }))
    .max(12)
    .catch([]),
  customerQuestions: z.array(str(400)).max(30).catch([]),
});
export type PilotAnalysis = z.infer<typeof PilotAnalysisSchema>;

/* ---------- Records ---------- */

export type Opportunity = {
  id: string;
  name: string;
  ownerRole: string;
  stage: string;
  useCase: string;
  notes: string;
  fictional: boolean;
  fixtureKey: string | null;
  source: string | null;
  version: number;
  lastEditedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceDoc = {
  id: string;
  opportunityId: string;
  name: string;
  kind: "reference" | "template" | "deal_file";
  content: string;
  approval: "approved" | "demo_only" | "unapproved";
  approvedBy: string | null;
  approvedOn: string | null;
  uploadedBy: string;
  createdAt: string;
};

export type RunDiff = {
  fromVersion: number;
  toVersion: number;
  scoreFrom: number;
  scoreTo: number;
  stageFrom: string;
  stageTo: string;
  lines: string[];
};

export type RunSummary = {
  id: string;
  version: number;
  mode: "ai" | "demo_fixture";
  model: string;
  createdBy: string;
  createdAt: string;
  durationMs: number;
  score: number;
  stage: string;
  diff: RunDiff | null;
};

export type Fact = { id: string; text: string; field: string | null; by: string; createdAt: string };
export type Comment = { id: string; targetType: string; targetId: string; targetLabel: string; role: string; body: string; createdAt: string };
export type AuditEvent = { id: string; actor: string; action: string; detail: string; createdAt: string };
export type Brief = { id: string; revision: number; content: string; mode: string; model: string; by: string; createdAt: string };

export type MouSegment =
  | { t: "text"; v: string }
  | { t: "ins"; key: string; v: string; source: string }
  | { t: "missing"; key: string };
export type Mou = {
  id: string;
  templateId: string;
  templateName: string;
  templateApproval: string;
  segments: MouSegment[];
  mode: string;
  by: string;
  createdAt: string;
};

export type KnowledgeMeta = { name: string; path: string; status: string; approvedBy: string; approvedOn: string; tier: "approved" | "demo_only" | "not_approved" };
export type LlmStatus = { configured: boolean; provider: string; model: string; briefModel: string; passes: string };

export type Bundle = {
  opportunity: Opportunity;
  docs: SourceDoc[];
  runs: RunSummary[];
  current: (RunSummary & { state: PilotAnalysis; stateVersion: number }) | null;
  facts: Fact[];
  comments: Comment[];
  audit: AuditEvent[];
  briefs: Brief[];
  mou: Mou | null;
  knowledge: KnowledgeMeta[];
  llm: LlmStatus;
  injectionFlags: string[];
};

export type Institution = {
  id: string;
  batch: string;
  rowNumber: number;
  name: string;
  isFi: boolean;
  score: number;
  data: Record<string, string>;
  breakdown: { factor: string; points: number; max: number; fact: string; source: string; verified: boolean }[];
  promotedOpportunityId: string | null;
  createdAt: string;
};

export function scoreFromCriteria(criteria: CriterionAssessment[]): number {
  const pts = criteria.reduce((n, c) => n + (c.status === "met" ? 1 : c.status === "partial" ? 0.5 : 0), 0);
  return Math.round((pts / CRITERIA.length) * 100);
}
