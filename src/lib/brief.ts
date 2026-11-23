import { criterionLabel, roleShort, stageLabel, type Opportunity, type PilotAnalysis } from "./types";

export const BRIEF_HEADER = "> **DRAFT: requires internal review.**";

const ev = (e: { sourceName: string; excerpt?: string; evidenceStatus: string }) =>
  `${e.sourceName}${e.excerpt ? ` — "${e.excerpt}"` : ""} [${e.evidenceStatus}]`;

/** Deterministic brief assembled from the reviewed analysis. Always available; never invents content. */
export function composeBrief(opp: Opportunity, a: PilotAnalysis, generatedLabel: string): string {
  const confirmed = a.findings.filter((f) => f.status === "confirmed" && f.review?.state !== "rejected");
  const unconfirmed = a.findings.filter((f) => f.status !== "confirmed" && f.review?.state !== "rejected");
  const capConfirmed = confirmed.filter((f) => f.category === "product" || f.category === "technical");
  const capAssumed = unconfirmed.filter((f) => f.category === "product" || f.category === "technical");
  const scope = a.disagreements.find((d) => d.criterion === "phase_one_scope");
  const scopeCrit = a.criteria.find((c) => c.key === "phase_one_scope");
  const openBlockers = a.blockers.filter((b) => b.state !== "resolved");
  const reviewTag = (f: PilotAnalysis["findings"][number]) => (f.review ? ` _(${f.review.state.replace("_", " ")} by ${f.review.by})_` : " _(not yet reviewed)_");
  const L: string[] = [];
  L.push(BRIEF_HEADER, "", `# Pilot Brief: ${opp.name}`, "");
  L.push(`**Use case:** ${opp.useCase}  `, `**Readiness stage:** ${stageLabel(a.readinessStage)}  `, `**Completeness:** ${a.completenessScore}/100 (share of ten criteria evidenced; not a probability of signing)  `, `**Generated:** ${generatedLabel}`, "");
  if (opp.fictional) L.push("> FICTIONAL demo opportunity. Illustrative only.", "");
  L.push("## Executive summary", "", a.executiveSummary || "Unknown.", "");
  L.push("## Problem and why now", "");
  const problem = confirmed.filter((f) => f.category === "commercial");
  L.push(problem.length ? problem.map((f) => `- ${f.description}`).join("\n") : "- [TO CONFIRM] No confirmed problem statement on record.", "");
  L.push("## Proposed CTS workflow", "");
  L.push(
    capConfirmed.length
      ? "The workflow below is limited to what the sources confirm. Anything not listed under verified capabilities must be validated before it is described to the customer."
      : "[TO CONFIRM] No CTS workflow can be described yet: no approved CTS capability reference is on file for this use case. Product and Engineering must confirm the workflow before it is shared with the customer.",
    "",
  );
  L.push("## Capabilities", "", "### Verified (supported by an approved or opportunity source)", "");
  L.push(capConfirmed.length ? capConfirmed.map((f) => `- **${f.title}.** ${f.description}${reviewTag(f)}`).join("\n") : "- None yet.", "");
  L.push("### Assumptions and unknowns (not verified — do not present as fact)", "");
  L.push(capAssumed.length ? capAssumed.map((f) => `- **${f.title}** (${f.status}). ${f.description}${reviewTag(f)}`).join("\n") : "- None recorded.", "");
  L.push("## Phase-one scope", "");
  if (scope?.resolution) L.push(`**In scope (decided by ${scope.resolution.by}):** ${scope.resolution.adopted}`, "", `**Rationale:** ${scope.resolution.rationale}`, "");
  else if (scope) L.push(`**[TO CONFIRM] Scope is contested and awaiting a human decision:** ${scope.topic}`, "", ...scope.positions.map((p) => `- ${p.reviewer}: ${p.position}`), "");
  else L.push(scopeCrit && scopeCrit.status !== "missing" ? scopeCrit.note : "[TO CONFIRM] Phase-one scope has not been defined.", "");
  L.push("**Out of scope:** [TO CONFIRM] unless stated in the decision above. Pricing, production rollout and any capability not listed as verified are out of scope for this draft.", "");
  L.push("## Integration approach and prerequisites", "");
  const integ = a.findings.filter((f) => f.category === "technical" && f.review?.state !== "rejected");
  L.push(integ.length ? integ.map((f) => `- ${f.title} (${f.status}). ${f.description}`).join("\n") : "- [TO CONFIRM] No integration information on record.", "");
  L.push("## KPIs", "");
  L.push(a.proposedKpis.length ? ["| KPI | Measurement | Baseline |", "|---|---|---|", ...a.proposedKpis.map((k) => `| ${k.name} | ${k.measurement} | ${k.baselineStatus} |`)].join("\n") : "[TO CONFIRM] No KPIs proposed.", "");
  L.push("_Proposed, not agreed with the customer._", "");
  L.push("## Dependencies, risks and owners", "");
  L.push(
    openBlockers.length
      ? ["| Priority | Blocker | Owner | Next action | Deadline | State |", "|---|---|---|---|---|---|", ...openBlockers.map((b) => `| ${b.priority} | ${b.title} | ${roleShort(b.ownerRole)} | ${b.recommendedAction} | ${b.deadline || "Not set"} | ${b.state.replace("_", " ")} |`)].join("\n")
      : "No open blockers.",
    "",
  );
  L.push("## Milestones", "");
  L.push(a.proposedMilestones.length ? a.proposedMilestones.map((m, i) => `${i + 1}. **${m.title}** — owner: ${roleShort(m.ownerRole)}. Exit: ${m.exitCriteria}`).join("\n") : "[TO CONFIRM] No milestones proposed.", "");
  L.push("## Commercial terms", "", "[TO CONFIRM] No pricing, fee or promotional term is included unless an approved commercial offer is on file.", "");
  L.push("## Next customer questions", "");
  L.push(a.customerQuestions.length ? a.customerQuestions.map((q) => `- ${q}`).join("\n") : "- None recorded.", "");
  L.push("## Decisions on record", "");
  const dec = a.disagreements.filter((d) => d.resolution);
  L.push(dec.length ? dec.map((d) => `- **${d.topic}** — ${d.resolution!.adopted} (decided by ${d.resolution!.by}; ${d.resolution!.rationale})`).join("\n") : "- None yet.", "");
  const open = a.disagreements.filter((d) => !d.resolution);
  if (open.length) L.push("**Open disagreements:**", ...open.map((d) => `- ${d.topic}`), "");
  L.push("## Completeness criteria", "", "| Criterion | Status | Note |", "|---|---|---|", ...a.criteria.map((c) => `| ${criterionLabel(c.key)} | ${c.status} | ${c.note} |`), "");
  L.push("## Evidence appendix", "");
  for (const f of a.findings) L.push(`- **${f.title}** (${f.status})`, ...(f.evidence.length ? f.evidence.map((e) => `  - ${ev(e)}`) : ["  - No evidence cited [unverified]"]));
  L.push("", "---", "_Internal draft. Not legal advice. Not customer-approved._");
  return L.join("\n");
}

export function generateBrief(opp: Opportunity, a: PilotAnalysis): { content: string; mode: string; model: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  return { content: composeBrief(opp, a, `${stamp} · assembled from the reviewed analysis (mock, no model)`), mode: "demo_fixture", model: "template-composer" };
}
