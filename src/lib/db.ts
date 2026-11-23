import type { AuditEvent, Brief, Comment, Fact, Institution, Mou, Opportunity, PilotAnalysis, RunDiff, SourceDoc } from "./types";

/**
 * Browser-only store. Everything lives in localStorage under one key, so the app runs as a static
 * site (GitHub Pages) with no server. Data never leaves the visitor's browser.
 * Tabs in the same browser share the store, which is how the multi-role demo works.
 */

export type RunRow = {
  id: string;
  opportunityId: string;
  version: number;
  mode: "demo_fixture";
  model: string;
  output: PilotAnalysis; // as generated
  state: PilotAnalysis; // with human edits
  diff: RunDiff | null;
  createdBy: string;
  createdAt: string;
};
type Scoped<T> = T & { opportunityId: string };

export type DB = {
  schema: number;
  seededAt: string;
  opportunities: Opportunity[];
  docs: SourceDoc[];
  runs: RunRow[];
  facts: Scoped<Fact>[];
  comments: Scoped<Comment>[];
  audit: Scoped<AuditEvent & { seq: number }>[];
  briefs: Scoped<Brief>[];
  mous: Scoped<Mou>[];
  institutions: Institution[];
};

export const STORAGE_KEY = "cosmos-pilot-engine:v2";
const SCHEMA = 3;

export const emptyDb = (): DB => ({ schema: SCHEMA, seededAt: "", opportunities: [], docs: [], runs: [], facts: [], comments: [], audit: [], briefs: [], mous: [], institutions: [] });

let memory: DB | null = null; // fallback when localStorage is unavailable (private mode, SSR)

export function readDb(): DB | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as DB;
    return parsed.schema === SCHEMA ? parsed : null;
  } catch {
    return memory;
  }
}

export function writeDb(db: DB) {
  memory = db;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked: keep working from memory for this tab */
  }
}

export const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

let clockOverride: string | null = null;
export const now = () => clockOverride ?? new Date().toISOString();
/** Runs fn with a fixed timestamp. Used only to back-date seeded mock history. */
export function at<T>(iso: string, fn: () => T): T {
  const prev = clockOverride;
  clockOverride = iso;
  try {
    return fn();
  } finally {
    clockOverride = prev;
  }
}

export function audit(db: DB, opportunityId: string, actor: string, action: string, detail = "") {
  db.audit.push({ id: uid(), opportunityId, actor, action, detail: detail.slice(0, 1000), createdAt: now(), seq: db.audit.length + 1 });
}
