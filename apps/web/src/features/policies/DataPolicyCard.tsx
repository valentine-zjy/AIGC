import type { PolicyItem } from "./data-governance-copy";

export function DataPolicyCard({
  title,
  items,
  footer,
}: {
  title: string;
  items: readonly PolicyItem[];
  footer?: string;
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-semibold text-[var(--ink-strong)]">{title}</h2>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-4"
          >
            <h3 className="text-sm font-semibold text-[var(--ink-strong)]">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-body)]">{item.summary}</p>
          </li>
        ))}
      </ul>

      {footer ? (
        <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">{footer}</p>
      ) : null}
    </section>
  );
}
