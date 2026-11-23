import { norm } from "./analysis";
import { FIXTURE_MOU_HINTS } from "./demo-data";
import type { Fact, MouSegment, Opportunity, PilotAnalysis, SourceDoc } from "./types";

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_ .-]{1,60}?)\s*\}\}|\[\[\s*([A-Za-z0-9_ .-]{1,60}?)\s*\]\]/g;
export const fieldKey = (raw: string) => raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");

export function templateFields(template: string): string[] {
  const keys = new Set<string>();
  for (const m of template.matchAll(PLACEHOLDER)) keys.add(fieldKey(m[1] ?? m[2]));
  return [...keys];
}

/** Fields that only Commercial may confirm, and that are never filled from notes or by a model. */
export const isCommercialField = (k: string) => /FEE|PRIC|COST|PAYMENT|COMMERCIAL|DISCOUNT|PROMO/.test(k);
/** Fields the model may never propose. They need a human click. */
const isHumanOnlyField = (k: string) => isCommercialField(k) || /SIGNATOR|GOVERNING|LAW|EFFECTIVE_DATE|ENTITY|TERM$|LIABILITY|INDEMN/.test(k);

type Fill = { value: string; source: string };

/**
 * Populates an approved template. The template text is never sent through a model for rewriting:
 * clauses are kept byte-for-byte and only placeholders are replaced. A value is inserted only if it
 * comes from the opportunity record, a recorded human decision, a human-confirmed field, or a seeded
 * hint whose excerpt is found verbatim in the discovery notes. Everything else is [TO CONFIRM].
 */
export function populateTemplate(args: { template: SourceDoc; opp: Opportunity; analysis: PilotAnalysis | null; facts: Fact[] }): { segments: MouSegment[]; mode: string } {
  const { template, opp, analysis, facts } = args;
  const keys = templateFields(template.content);
  const fills = new Map<string, Fill>();

  for (const k of keys) {
    if (/^(INSTITUTION|COUNTERPARTY|BANK|CUSTOMER)(_NAME)?$/.test(k)) fills.set(k, { value: opp.name, source: "Opportunity record" });
    if (/^USE_CASE$/.test(k) && opp.useCase && opp.useCase !== "Other") fills.set(k, { value: opp.useCase.toLowerCase(), source: "Opportunity record" });
    if (/PHASE_ONE_SCOPE|^SCOPE$/.test(k)) {
      const d = analysis?.disagreements.find((x) => x.criterion === "phase_one_scope" && x.resolution);
      if (d?.resolution) fills.set(k, { value: d.resolution.adopted, source: `Human decision (${d.resolution.by})` });
    }
  }

  const mode = "demo_fixture";
  const notes = norm(opp.notes);
  const open = keys.filter((k) => !fills.has(k) && !isHumanOnlyField(k));
  if (opp.fixtureKey) {
    for (const [k, h] of Object.entries(FIXTURE_MOU_HINTS[opp.fixtureKey] ?? {}))
      if (open.includes(k) && !fills.has(k) && notes.includes(norm(h.excerpt))) fills.set(k, { value: h.value, source: `Discovery notes: "${h.excerpt}"` });
  }

  // Human-confirmed fields always win. Commercial fields accept only Commercial's confirmation.
  for (const f of facts) {
    if (!f.field || !keys.includes(f.field)) continue;
    if (isCommercialField(f.field) && !/commercial/i.test(f.by)) continue;
    fills.set(f.field, { value: f.text, source: `Confirmed by ${f.by}` });
  }

  const segments: MouSegment[] = [];
  let last = 0;
  for (const m of template.content.matchAll(PLACEHOLDER)) {
    const i = m.index ?? 0;
    if (i > last) segments.push({ t: "text", v: template.content.slice(last, i) });
    const k = fieldKey(m[1] ?? m[2]);
    const fill = fills.get(k);
    segments.push(fill ? { t: "ins", key: k, v: fill.value, source: fill.source } : { t: "missing", key: k });
    last = i + m[0].length;
  }
  if (last < template.content.length) segments.push({ t: "text", v: template.content.slice(last) });
  return { segments, mode };
}

export const MOU_BANNER = "Not legal advice. Requires authorized Legal review. Not ready for signature.";

export function mouToMarkdown(segments: MouSegment[], templateName: string): string {
  const body = segments.map((s) => (s.t === "text" ? s.v : s.t === "ins" ? `**${s.v}**` : `**[TO CONFIRM: ${s.key}]**`)).join("");
  const inserted = segments.filter((s): s is Extract<MouSegment, { t: "ins" }> => s.t === "ins");
  const missing = [...new Set(segments.filter((s) => s.t === "missing").map((s) => (s as { key: string }).key))];
  return [
    `> **${MOU_BANNER}**`,
    `> Draft populated from template "${templateName}". Original clauses are unchanged; inserted values are in bold.`,
    "",
    body.trim(),
    "",
    "---",
    "### Inserted values and their sources",
    ...(inserted.length ? inserted.map((s) => `- ${s.key}: ${s.v} — ${s.source}`) : ["- None"]),
    "",
    "### Terms still to confirm",
    ...(missing.length ? missing.map((k) => `- ${k}`) : ["- None"]),
  ].join("\n");
}
