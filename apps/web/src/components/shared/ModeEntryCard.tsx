import type { ReactNode } from "react";

import type { ProcessingMode } from "@ai-rewrite/contracts";

type ModeEntryCardProps = {
  mode: ProcessingMode;
  eyebrow: string;
  title: string;
  summary: string;
  benefit: string;
  riskNote: string;
  details: string[];
  actionLabel: string;
  variant?: "primary" | "secondary";
  icon: ReactNode;
};

export function ModeEntryCard({
  mode,
  eyebrow,
  title,
  summary,
  benefit,
  riskNote,
  details,
  actionLabel,
  variant = "secondary",
  icon,
}: ModeEntryCardProps) {
  const isPrimary = variant === "primary";

  return (
    <article
      className="group flex h-full flex-col rounded-[2rem] border border-[color:var(--border-strong)] bg-[var(--surface-elevated)] p-7 shadow-[var(--shadow-card)] transition-transform duration-200 hover:-translate-y-1"
      aria-labelledby={`${mode}-title`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {eyebrow}
          </p>
          <h2
            id={`${mode}-title`}
            className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]"
          >
            {title}
          </h2>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-accent)] p-3 text-[var(--accent-strong)]">
          {icon}
        </div>
      </div>

      <p className="mt-5 text-base leading-7 text-[var(--ink-body)]">{summary}</p>

      <dl className="mt-6 space-y-4 text-sm leading-6 text-[var(--ink-body)]">
        <div>
          <dt className="font-semibold text-[var(--ink-strong)]">核心收益</dt>
          <dd>{benefit}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--ink-strong)]">风险提示</dt>
          <dd>{riskNote}</dd>
        </div>
      </dl>

      <ul className="mt-6 space-y-3 text-sm leading-6 text-[var(--ink-body)]">
        {details.map((detail) => (
          <li key={detail} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent-strong)]"
            />
            <span>{detail}</span>
          </li>
        ))}
      </ul>

      <form action="/api/task-contexts" method="post" className="mt-8">
        <input type="hidden" name="mode" value={mode} />
        <button
          type="submit"
          className={
            isPrimary
              ? "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-elevated)]"
              : "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[var(--border-strong)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-elevated)]"
          }
        >
          {actionLabel}
        </button>
      </form>
    </article>
  );
}
