"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import type { Bundle } from "@/lib/types";

export function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted">Not analyzed</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${score}%` }} />
      </span>
      <span className="tnum text-xs font-medium text-ink">{score}</span>
    </span>
  );
}

export async function readTextFile(file: File, maxBytes = 200_000): Promise<string> {
  if (!/\.(md|txt|markdown)$/i.test(file.name)) throw new Error("Only .txt and .md files are accepted.");
  if (file.size > maxBytes) throw new Error("That file is too large. The limit is 200 KB.");
  return file.text();
}

export function FilePick({ label, accept = ".txt,.md,.markdown", onFile }: { label: string; accept?: string; onFile: (f: File) => void }) {
  return (
    <label className="t-quick inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-xs font-medium whitespace-nowrap shadow-sm hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-accent/30">
      <Upload className="size-3.5" />
      {label}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

export type Workspace = {
  b: Bundle;
  /** Posts an action; resolves true on success. Errors are shown as toasts. */
  act: (action: Record<string, unknown>, okMessage?: string) => Promise<boolean>;
  analyze: () => Promise<void>;
  analyzing: boolean;
  saveNotes: (notes: string, expectedVersion: number) => Promise<boolean>;
};
export const WorkspaceCtx = React.createContext<Workspace | null>(null);
export function useWorkspace(): Workspace {
  const w = React.useContext(WorkspaceCtx);
  if (!w) throw new Error("Workspace context missing");
  return w;
}

/** Eases a number from its previous value to the new one. Honors reduced-motion. */
export function useCountUp(target: number, ms = 1100): number {
  const [v, setV] = React.useState(0);
  const from = React.useRef(0);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      return setV(target);
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 4);
      const cur = a + (target - a) * eased;
      from.current = cur;
      setV(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function CountUp({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{Math.round(useCountUp(value))}</span>;
}
