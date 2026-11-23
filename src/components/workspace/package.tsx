"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Download, Lock, ShieldAlert } from "lucide-react";
import { Badge, Banner, Button, Card, CardHeader, Empty, Input, Segmented, Select, Textarea, cn } from "@/components/ui";
import { download, fmtTime, useRole, useToast } from "@/components/shell";
import { FilePick, readTextFile, useWorkspace } from "@/components/common";
import { roleLabel, type MouSegment } from "@/lib/types";

const slug = (s: string) => s.toLowerCase().replace(/\(fictional\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MOU_BANNER = "Not legal advice. Requires authorized Legal review. Not ready for signature.";
const isCommercialField = (k: string) => /FEE|PRIC|COST|PAYMENT|COMMERCIAL|DISCOUNT|PROMO/.test(k);

function mouMarkdown(segments: MouSegment[], templateName: string) {
  const body = segments.map((s) => (s.t === "text" ? s.v : s.t === "ins" ? `**${s.v}**` : `**[TO CONFIRM: ${s.key}]**`)).join("");
  const ins = segments.filter((s): s is Extract<MouSegment, { t: "ins" }> => s.t === "ins");
  const missing = [...new Set(segments.filter((s): s is Extract<MouSegment, { t: "missing" }> => s.t === "missing").map((s) => s.key))];
  return [`> **${MOU_BANNER}**`, `> Draft populated from template "${templateName}". Original clauses are unchanged; inserted values are in bold.`, "", body.trim(), "", "---", "### Inserted values and their sources", ...(ins.length ? ins.map((s) => `- ${s.key}: ${s.v} — ${s.source}`) : ["- None"]), "", "### Terms still to confirm", ...(missing.length ? missing.map((k) => `- ${k}`) : ["- None"])].join("\n");
}

function BriefPanel() {
  const { b, act } = useWorkspace();
  const toast = useToast();
  const [mode, setMode] = React.useState<"preview" | "edit">("preview");
  const [rev, setRev] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const [base, setBase] = React.useState(0);
  const [busy, setBusy] = React.useState<"" | "gen" | "save">("");
  const latest = b.briefs[0];
  const shown = b.briefs.find((x) => x.revision === rev) ?? latest;
  const name = `pilot-brief-${slug(b.opportunity.name)}`;

  if (!b.current) return <Empty title="No pilot brief yet">The brief is built from the reviewed analysis. Run an analysis first.</Empty>;

  const generate = async () => {
    setBusy("gen");
    if (await act({ type: "generateBrief" }, "Draft brief generated.")) {
      setRev(null);
      setMode("preview");
    }
    setBusy("");
  };

  if (!latest)
    return (
      <Empty
        title="No pilot brief yet"
        action={
          <Button variant="primary" onClick={generate} loading={busy === "gen"}>
            Generate draft brief
          </Button>
        }
      >
        Generates a draft from the current analysis, including recorded decisions and reviews. It is always marked &ldquo;DRAFT: requires internal review.&rdquo;
      </Empty>
    );

  return (
    <Card>
      <CardHeader
        title="Pilot brief"
        sub={
          <>
            Revision {shown.revision} · {shown.mode === "human_edit" ? "edited by a person" : "assembled from the reviewed analysis"} · {shown.by} · {fmtTime(shown.createdAt)}
          </>
        }
        right={
          <>
            {b.briefs.length > 1 && (
              <Select aria-label="Revision" className="h-7 w-auto text-xs" value={shown.revision} onChange={(e) => { setRev(Number(e.target.value)); setMode("preview"); }}>
                {b.briefs.map((x) => (
                  <option key={x.id} value={x.revision}>
                    Rev {x.revision}{x.revision === latest.revision ? " (latest)" : ""}
                  </option>
                ))}
              </Select>
            )}
            <Segmented
              value={mode}
              onChange={(m) => {
                if (m === "edit") {
                  setDraft(latest.content);
                  setBase(latest.revision);
                  setRev(null);
                }
                setMode(m);
              }}
              options={[
                { value: "preview", label: "Preview" },
                { value: "edit", label: "Edit" },
              ]}
            />
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-zinc-50/60 px-4 py-2.5">
        <Badge tone="amber">DRAFT: requires internal review</Badge>
        {shown.mode !== "human_edit" && <Badge tone="amber">Mock · no model called</Badge>}
        <span className="flex-1" />
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(mode === "edit" ? draft : shown.content);
              toast("Brief copied to the clipboard.");
            } catch {
              toast("Your browser blocked clipboard access. Use Download instead.", "error");
            }
          }}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button size="sm" onClick={() => download(`${name}.md`, mode === "edit" ? draft : shown.content)}>
          <Download className="size-3.5" />
          .md
        </Button>
        <Button size="sm" onClick={() => download(`${name}.txt`, mode === "edit" ? draft : shown.content)}>
          <Download className="size-3.5" />
          .txt
        </Button>
        <Button size="sm" onClick={generate} loading={busy === "gen"} title="Builds a new revision from the current analysis. Earlier revisions are kept.">
          Regenerate
        </Button>
      </div>
      {mode === "edit" ? (
        <div className="space-y-3 p-5">
          {latest.revision !== base && <Banner>{latest.by} saved revision {latest.revision} while you were editing. Saving will be refused so their work is not overwritten. Copy your text, switch to Preview, then edit the latest revision.</Banner>}
          <Textarea aria-label="Brief Markdown" value={draft} onChange={(e) => setDraft(e.target.value)} rows={26} className="font-mono text-[13px]" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode("preview")}>
              Discard changes
            </Button>
            <Button
              variant="primary"
              loading={busy === "save"}
              disabled={draft === latest.content || !draft.trim()}
              onClick={async () => {
                setBusy("save");
                if (await act({ type: "saveBrief", content: draft, baseRevision: base }, "Saved as a new revision.")) setMode("preview");
                setBusy("");
              }}
            >
              Save as revision {base + 1}
            </Button>
          </div>
        </div>
      ) : (
        <article className="prose prose-sm prose-zinc max-w-none px-6 py-5 prose-headings:font-semibold prose-h1:text-xl prose-h2:mt-6 prose-h2:text-base prose-table:text-xs prose-blockquote:border-amber-300 prose-blockquote:font-normal prose-blockquote:not-italic">
          {/* react-markdown does not render raw HTML, so model or user text cannot inject markup. */}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{shown.content}</ReactMarkdown>
        </article>
      )}
    </Card>
  );
}

function ConfirmField({ k }: { k: string }) {
  const { act } = useWorkspace();
  const { role } = useRole();
  const [v, setV] = React.useState("");
  const locked = isCommercialField(k) && role !== "commercial";
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await act({ type: "addFact", text: v, field: k })) {
          setV("");
          await act({ type: "generateMou" }, `${k} confirmed and inserted.`);
        }
      }}
    >
      <span className="w-44 shrink-0 truncate font-mono text-[11px] text-ink" title={k}>
        {k}
      </span>
      <Input aria-label={`Value for ${k}`} value={v} onChange={(e) => setV(e.target.value)} disabled={locked} placeholder={locked ? "Only the Commercial role can confirm this term" : "Confirmed value"} className="h-8 text-xs" />
      <Button size="sm" type="submit" disabled={locked || v.trim().length < 2}>
        Confirm
      </Button>
    </form>
  );
}

function MouPanel() {
  const { b, act } = useWorkspace();
  const { role } = useRole();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const templates = b.docs.filter((d) => d.kind === "template");
  const usable = templates.filter((t) => t.approval === "approved" || t.approval === "demo_only");
  const mou = b.mou;
  const missing = mou ? [...new Set(mou.segments.filter((s): s is Extract<MouSegment, { t: "missing" }> => s.t === "missing").map((s) => s.key))] : [];
  const inserted = mou ? mou.segments.filter((s): s is Extract<MouSegment, { t: "ins" }> => s.t === "ins") : [];

  const generate = async () => {
    setBusy(true);
    await act({ type: "generateMou" }, "Agreement draft populated from the template.");
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader
        title="MOU / LOI draft"
        sub="Populated only from a template that Legal has uploaded and approved. The app never writes agreement language."
        right={
          <>
            {!templates.some((t) => /FICTIONAL/.test(t.content.slice(0, 200))) && (
              <Button size="sm" onClick={() => act({ type: "loadDemoTemplate" }, "Fictional demo template uploaded. It still needs Legal approval.")}>
                Load fictional demo template
              </Button>
            )}
            <FilePick
              label="Upload template"
              onFile={async (f) => {
                try {
                  await act({ type: "addDoc", name: f.name, kind: "template", content: await readTextFile(f) }, "Template uploaded. It needs Legal approval before it can be used.");
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
            />
          </>
        }
      />
      <div className="border-b border-line px-4 py-3">
        <Banner tone="red">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <strong>{MOU_BANNER}</strong>
        </Banner>
      </div>

      {templates.length > 0 && (
        <ul className="divide-y divide-line border-b border-line">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="min-w-0">
                <span className="text-sm font-medium text-ink">{t.name}</span>
                <span className="block text-xs text-muted">{t.approvedBy ? `Approved by ${t.approvedBy} on ${t.approvedOn}` : `Uploaded by ${t.uploadedBy} · awaiting Legal approval`}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={t.approval === "approved" ? "green" : t.approval === "demo_only" ? "violet" : "amber"}>{t.approval === "approved" ? "Approved" : t.approval === "demo_only" ? "Approved for demo only" : "Not approved"}</Badge>
                <Button size="sm" disabled={role !== "legal"} title={role !== "legal" ? "Switch role to Legal to change template approval" : undefined} onClick={() => act({ type: "setDocApproval", docId: t.id, approved: t.approval === "unapproved" }, t.approval === "unapproved" ? "Template approved." : "Template approval removed.")}>
                  {t.approval === "unapproved" ? "Mark approved" : "Remove approval"}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {templates.length > 0 && role !== "legal" && usable.length === 0 && <p className="border-b border-line bg-zinc-50 px-4 py-2 text-xs text-muted">Only the Legal role can approve a template. Switch role to Legal (simulated) to continue.</p>}

      {usable.length === 0 ? (
        <div className="p-5">
          <Empty title="Upload an approved template to generate a populated agreement.">
            <Lock className="mr-1 inline size-3.5 align-[-2px]" />
            No MOU or boilerplate is generated without one. {templates.length ? "The uploaded template has not been approved yet." : "Upload a .md or .txt template with {{FIELD_NAME}} placeholders."}
          </Empty>
        </div>
      ) : !mou ? (
        <div className="p-5">
          <Empty
            title="Template approved"
            action={
              <Button variant="primary" onClick={generate} loading={busy}>
                Populate agreement draft
              </Button>
            }
          >
            Original clauses are kept word for word. Only fields the sources support are filled in; every other term becomes [TO CONFIRM].
          </Empty>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-zinc-50/60 px-4 py-2.5 text-xs text-muted">
            <span>
              From <span className="font-medium text-ink">{mou.templateName}</span> · {mou.by} · {fmtTime(mou.createdAt)}
            </span>
            {mou.templateApproval === "demo_only" && <Badge tone="violet">Fictional template</Badge>}
            <Badge tone="amber">Mock · no model called</Badge>
            <span className="flex-1" />
            <span className="tnum">
              <mark className="rounded bg-violet-100 px-1 text-accent-strong">{inserted.length} inserted</mark> · <mark className="rounded bg-amber-100 px-1 text-amber-900">{missing.length} to confirm</mark>
            </span>
            <Button size="sm" onClick={() => download(`agreement-draft-${slug(b.opportunity.name)}.md`, mouMarkdown(mou.segments, mou.templateName))}>
              <Download className="size-3.5" />
              .md
            </Button>
            <Button size="sm" onClick={generate} loading={busy}>
              Repopulate
            </Button>
          </div>
          <div className="px-6 py-5 font-serif text-[14px] leading-7 whitespace-pre-wrap text-ink">
            {mou.segments.map((s, i) =>
              s.t === "text" ? (
                <React.Fragment key={i}>{s.v}</React.Fragment>
              ) : s.t === "ins" ? (
                <mark key={i} title={`${s.key} — ${s.source}`} className="rounded bg-violet-100 px-1 font-sans text-[13px] font-medium text-accent-strong">
                  {s.v}
                </mark>
              ) : (
                <mark key={i} title={s.key} className="rounded bg-amber-100 px-1 font-sans text-[13px] font-semibold text-amber-900">
                  [TO CONFIRM: {s.key}]
                </mark>
              ),
            )}
          </div>
          <div className="grid gap-5 border-t border-line p-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold text-ink">Inserted values and their sources</h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-5">
                {inserted.length === 0 && <li className="text-muted">Nothing inserted.</li>}
                {[...new Map(inserted.map((s) => [s.key, s])).values()].map((s) => (
                  <li key={s.key}>
                    <span className="font-mono text-[11px] text-ink">{s.key}</span>
                    <span className="block text-muted">{s.source}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink">Terms still to confirm</h3>
              <p className={cn("mt-1 text-xs text-muted", !missing.length && "hidden")}>A named person confirms each value as {roleLabel(role)}. Commercial terms can be confirmed only in the Commercial role.</p>
              <div className="mt-2 space-y-1.5">
                {missing.length === 0 && <p className="text-xs text-muted">None. Legal review is still required.</p>}
                {missing.map((k) => (
                  <ConfirmField key={k} k={k} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export function PackageTab() {
  return (
    <div className="space-y-6">
      <BriefPanel />
      <MouPanel />
    </div>
  );
}
