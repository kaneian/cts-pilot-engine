"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import type { Evidence } from "@/lib/types";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

/* shadcn-style primitives, written locally so the project has no registry dependency. */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean };
export function Button({ className, variant = "secondary", size = "md", loading, disabled, children, ...p }: BtnProps) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cn(
        "t-quick inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-ink text-white hover:bg-navy-700",
        variant === "secondary" && "border border-line bg-white text-ink hover:border-zinc-300 hover:bg-canvas",
        variant === "ghost" && "text-muted hover:bg-canvas hover:text-ink",
        variant === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        className,
      )}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-lg border border-line bg-white", className)} />;
}
export function CardHeader({ title, sub, right, className }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

const TONES = {
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
  teal: "bg-accent-soft text-accent-strong border-violet-200",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  navy: "bg-navy-800 text-white border-navy-700",
  violet: "bg-violet-50 text-violet-800 border-violet-200",
} as const;
export type Tone = keyof typeof TONES;
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span {...p} className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap", TONES[tone], className)} />;
}

const field = "t-quick w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-zinc-400 hover:border-zinc-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cn(field, "h-8", className)} />;
});
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(field, "py-2 leading-relaxed", className)} />;
}
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(field, "h-8 pr-8", className)} />;
}
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...p} className={cn("mb-1 block text-xs font-medium text-muted", className)} />;
}

export function Banner({ tone = "amber", children, className }: { tone?: "amber" | "teal" | "red" | "navy"; children: React.ReactNode; className?: string }) {
  const t = { amber: "border-amber-200 bg-amber-50 text-amber-900", teal: "border-violet-200 bg-accent-soft text-accent-strong", red: "border-red-200 bg-red-50 text-red-800", navy: "border-navy-700 bg-navy-900 text-zinc-100" }[tone];
  return <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-5", t, className)}>{children}</div>;
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white/60 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-md text-xs leading-5 text-muted">{children}</p>}
      {action && <div className="mt-4 flex gap-2">{action}</div>}
    </div>
  );
}

export function EvidenceList({ items }: { items: Evidence[] }) {
  if (!items.length) return <p className="text-xs text-amber-700">No evidence cited. Treated as unverified.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((e, i) => {
        const missing = e.sourceId?.startsWith("missing:") ? e.sourceId.slice(8) : null;
        return (
          <li key={i} className="flex items-start gap-1.5 text-xs leading-5">
            {e.evidenceStatus === "supported" ? (
              <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="Supported" />
            ) : e.evidenceStatus === "contradictory" ? (
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-red-600" aria-label="Contradictory" />
            ) : (
              <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-label="Unverified" />
            )}
            <span className="min-w-0">
              <span className="font-medium text-ink">{e.sourceName}</span>
              <span className={cn("ml-1.5", e.evidenceStatus === "supported" ? "text-emerald-700" : e.evidenceStatus === "contradictory" ? "text-red-700" : "text-amber-700")}>{e.evidenceStatus}</span>
              {e.excerpt && <span className="block text-muted">“{e.excerpt.replace(/^["“]|["”]$/g, "")}”</span>}
              {missing && <span className="block text-muted italic">{missing}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "alert" }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("tnum mt-1.5 text-3xl font-semibold tracking-tight", tone === "alert" ? "text-red-700" : "text-ink")}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-4 text-muted">{hint}</p>}
    </Card>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-zinc-100 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value} className={cn("t-quick rounded px-2.5 py-1 text-xs font-medium", value === o.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
