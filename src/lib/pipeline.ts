import type { Institution } from "./types";

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1, 501).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim().slice(0, 500)])));
}

const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v) ?? "";

type Scored = Pick<Institution, "name" | "isFi" | "score" | "breakdown" | "data">;

/**
 * Transparent rule-based qualification. No model call and no web lookup: every point traces to a
 * CSV cell. A fact is marked verified only when the CSV's `verified_fields` column lists it.
 */
export function scoreInstitution(r: Record<string, string>, rowNumber: number, fileName: string): Scored {
  const name = pick(r, "institution", "company", "organization", "organisation", "name") || `Row ${rowNumber}`;
  const type = pick(r, "type", "institution_type", "category").toLowerCase();
  const verifiedList = pick(r, "verified_fields", "verified").toLowerCase();
  const src = `${fileName}, row ${rowNumber}`;
  const v = (field: string) => verifiedList.split(/[;|]/).map((s) => s.trim()).includes(field);
  const isFi = /bank|credit union|savings|thrift|trust company|financial institution/.test(type) || (!type && /\b(bank|credit union)\b/i.test(name));
  const breakdown: Institution["breakdown"] = [];
  breakdown.push({ factor: "Institution type", points: isFi ? 30 : 0, max: 30, fact: type ? `Type: ${type}` : "Type not provided", source: src, verified: v("type") });
  if (!isFi) return { name, isFi, score: 0, breakdown, data: r };

  const assetsRaw = pick(r, "asset_size_usd_m", "assets_usd_m", "assets");
  const assets = Number(assetsRaw.replace(/[^0-9.]/g, ""));
  const assetPts = !assetsRaw || !isFinite(assets) || assets <= 0 ? 0 : assets >= 1000 && assets <= 50000 ? 20 : assets < 1000 ? 12 : 10;
  breakdown.push({ factor: "Asset size", points: assetPts, max: 20, fact: assetsRaw ? `Assets: $${assets.toLocaleString("en-US")}M (as listed)` : "Asset size not provided", source: src, verified: v("asset_size") });

  const core = pick(r, "core_provider", "core", "core_platform");
  const corePts = /fiserv|jack henry/i.test(core) ? 15 : core ? 6 : 0;
  breakdown.push({
    factor: "Core provider",
    points: corePts,
    max: 15,
    fact: core ? `Core provider: ${core}${corePts === 15 ? " (CTS has a marketplace listing; integration depth is NOT assumed)" : ""}` : "Core provider not provided",
    source: src,
    verified: v("core_provider"),
  });

  const title = pick(r, "contact_title", "title", "job_title");
  const fn = /treasur|payment|digital|innovation|deposit|product|strategy/i.test(title);
  const senior = /chief|cfo|coo|cio|cto|ceo|president|evp|svp|head|director|vp\b/i.test(title);
  const titlePts = (fn ? 12 : 0) + (senior ? 8 : 0);
  breakdown.push({ factor: "Contact role", points: titlePts, max: 20, fact: title ? `Contact title: ${title}` : "Contact title not provided", source: src, verified: v("contact_title") });

  const interest = pick(r, "interest_notes", "notes", "interest");
  const kw = (interest.match(/tokeni[sz]|settlement|escrow|deposit|24\/7|treasury|collateral|interoperab|instant|real-time/gi) ?? []).length;
  const intPts = Math.min(15, kw * 5);
  breakdown.push({ factor: "Stated interest", points: intPts, max: 15, fact: interest ? `Notes: "${interest}"` : "No interest notes", source: src, verified: v("interest_notes") });

  return { name, isFi, score: breakdown.reduce((n, b) => n + b.points, 0), breakdown, data: r };
}

export function promoteNotes(i: Institution): string {
  const lines = [
    `Promoted from Pipeline Intake (${i.batch}, row ${i.rowNumber}). Qualification score ${i.score}/100 (rule-based, from the attendee list only).`,
    "",
    "What the attendee list says (check before relying on it):",
    ...i.breakdown.map((b) => `- ${b.verified ? "[verified]" : "[UNVERIFIED]"} ${b.fact}`),
    "",
    "No discovery conversation has been recorded yet. Replace this text with call notes.",
  ];
  return lines.join("\n");
}

export function guessUseCase(i: Institution): string {
  const t = (i.data.interest_notes || i.data.notes || "").toLowerCase();
  if (/escrow/.test(t)) return "Programmable escrow";
  if (/24\/7|settlement/.test(t)) return "24/7 settlement";
  if (/sweep|treasury/.test(t)) return "Treasury sweeps";
  if (/collateral/.test(t)) return "Collateral mobility";
  if (/interoperab/.test(t)) return "Interoperability";
  if (/deposit/.test(t)) return "Tokenized deposits";
  return "Other";
}
