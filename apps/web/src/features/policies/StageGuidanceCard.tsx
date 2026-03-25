export function StageGuidanceCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: readonly string[];
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        当前阶段说明
      </p>
      <h2 className="mt-3 text-xl font-semibold text-[var(--ink-strong)]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-body)]">{description}</p>

      <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--ink-body)]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent-strong)]"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
