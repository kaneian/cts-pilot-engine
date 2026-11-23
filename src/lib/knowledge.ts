import type { KnowledgeMeta } from "./types";

/**
 * Mock knowledge base. In this static demo the CTS reference files are embedded here.
 * All three reference files are unfilled placeholders, so no capability or commercial
 * claim can ever be "supported". The demo pack is illustrative only.
 */
const RAW: { path: string; raw: string }[] = [
  {
    "path": "knowledge/commercial-offers.md",
    "raw": "---\napproved_by:\napproved_on:\nstatus: draft\n---\n# Commercial offers\n\n[[ONLY terms Eran has approved, each dated, with an APPROVED_FOR_OUTREACH flag]]\n\nWhile this file is empty or unapproved, the app outputs [TO CONFIRM] for every commercial term.\n"
  },
  {
    "path": "knowledge/cts-capabilities.md",
    "raw": "---\napproved_by:\napproved_on:\nstatus: draft\n---\n# CTS capabilities\n\nComponents: Tokenization Engine, Permissioned Cosmos Ledger, IBC.\n\n## Supported today\n[[FILL IN with Product/Eng, dated and approved]]\n\n## Roadmap (not supported today)\n[[FILL IN with Product/Eng, dated and approved]]\n"
  },
  {
    "path": "knowledge/demo/cts-illustrative.md",
    "raw": "---\napproved_by: none (demo pack)\napproved_on:\nstatus: demo_only\n---\n# Demo knowledge pack \u2014 ILLUSTRATIVE ONLY\n\nThis file exists so the demo has something to cite. It is not an approved Cosmos reference and never makes a claim \"supported\".\n\n- CTS is described as three components: a Tokenization Engine, a Permissioned Cosmos Ledger, and IBC.\n- Which capabilities are supported today versus on the roadmap is not stated here. Ask Product.\n- Integration depth with any core banking provider is not stated here. Ask Engineering.\n- No pricing or promotional offer is stated here. Ask Commercial.\n"
  },
  {
    "path": "knowledge/integrations.md",
    "raw": "---\napproved_by:\napproved_on:\nstatus: draft\n---\n# Integrations\n\nPositioning: CTS/IBC is a complementary interoperability layer.\n\n## Fiserv AppMarket\nDepth and scope of integration: [[FILL IN]]\n\n## Jack Henry marketplace\nDepth and scope of integration: [[FILL IN]]\n"
  }
];

export type KnowledgeFile = KnowledgeMeta & { body: string };

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

export function loadKnowledge(): KnowledgeFile[] {
  return RAW.map(({ path, raw }) => {
    const { meta, body } = parseFrontMatter(raw);
    const hasPlaceholders = /\[\[[^\]]*\]\]/.test(body);
    let tier: KnowledgeMeta["tier"] = "not_approved";
    if (meta.status === "approved" && meta.approved_by && meta.approved_on && !hasPlaceholders) tier = "approved";
    else if (meta.status === "demo_only") tier = "demo_only";
    return { name: path.replace(/^knowledge\//, ""), path, status: meta.status || "missing", approvedBy: meta.approved_by || "", approvedOn: meta.approved_on || "", tier, body: body.trim() };
  });
}

export function knowledgeMeta(): KnowledgeMeta[] {
  return loadKnowledge().map((k) => ({ name: k.name, path: k.path, status: k.status, approvedBy: k.approvedBy, approvedOn: k.approvedOn, tier: k.tier }));
}
