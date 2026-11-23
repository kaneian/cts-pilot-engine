"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, Card, CardHeader, Input, Label, Select, Textarea } from "@/components/ui";
import { api, oppHref, useRole, useToast } from "@/components/shell";
import { ROLES, USE_CASES, type RoleKey } from "@/lib/types";
import { FilePick, readTextFile } from "@/components/common";

export default function NewOpportunityPage() {
  const router = useRouter();
  const toast = useToast();
  const { role } = useRole();
  const [name, setName] = React.useState("");
  const [ownerRole, setOwnerRole] = React.useState<RoleKey>("partnerships");
  const [useCase, setUseCase] = React.useState<string>(USE_CASES[0]);
  const [notes, setNotes] = React.useState("");
  const [docs, setDocs] = React.useState<{ name: string; content: string }[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Give the opportunity a name.");
    setBusy(true);
    try {
      const r = await api<{ opportunity: { id: string } }>("/api/opportunities", { name, ownerRole, stage: "discovery", useCase, notes, docs, actor: role });
      toast("Opportunity created.");
      router.push(oppHref(r.opportunity.id));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-ink">
          ← Overview
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">New opportunity</h1>
        <p className="mt-1 text-sm text-muted">This is a public mock-data demo. Use invented names and notes only: what you type is stored in this browser and never sent anywhere.</p>
      </div>

      <Card>
        <CardHeader title="Institution" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Institution name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Example Valley Bank (invented)" autoFocus />
          </div>
          <div>
            <Label htmlFor="owner">Opportunity owner</Label>
            <Select id="owner" value={ownerRole} onChange={(e) => setOwnerRole(e.target.value as RoleKey)}>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="uc">Use case</Label>
            <Select id="uc" value={useCase} onChange={(e) => setUseCase(e.target.value)}>
              {USE_CASES.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Discovery notes"
          sub="Paste call notes, or load a .txt / .md file. Stage starts at Discovery and is updated by the analysis."
          right={
            <FilePick
              label="Load file"
              onFile={async (f) => {
                try {
                  setNotes(await readTextFile(f));
                } catch (err) {
                  toast((err as Error).message, "error");
                }
              }}
            />
          }
        />
        <div className="p-5">
          <Textarea aria-label="Discovery notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={12} placeholder={"Who was on the call, what they want, what is unknown…"} className="font-mono text-[13px]" />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Reference documents (optional)"
          sub="Uploaded as not approved. A reviewer can approve them later; only approved documents count as top-tier sources."
          right={
            <FilePick
              label="Add document"
              onFile={async (f) => {
                if (docs.length >= 5) return toast("You can attach up to five documents here. Add more from the Discovery tab.", "error");
                try {
                  const content = await readTextFile(f);
                  setDocs((d) => [...d, { name: f.name, content }]);
                } catch (err) {
                  toast((err as Error).message, "error");
                }
              }}
            />
          }
        />
        <div className="p-5">
          {docs.length === 0 ? (
            <p className="text-xs text-muted">No documents attached.</p>
          ) : (
            <ul className="space-y-1.5">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
                  <span>
                    {d.name} <span className="tnum text-xs text-muted">· {(d.content.length / 1000).toFixed(1)} KB</span>
                  </span>
                  <button type="button" aria-label={`Remove ${d.name}`} onClick={() => setDocs((x) => x.filter((_, j) => j !== i))} className="text-muted hover:text-ink">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Link href="/">
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
        <Button type="submit" variant="primary" loading={busy}>
          Create opportunity
        </Button>
      </div>
    </form>
  );
}
