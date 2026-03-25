import type { FormatCapabilityEntry } from "./format-capability-matrix";

function getCapabilityStateLabel(state: FormatCapabilityEntry["capabilities"]["read"]["state"]) {
  switch (state) {
    case "supported":
      return "支持";
    case "limited":
      return "有限";
    case "unsupported":
      return "不支持";
  }
}

export function FormatCapabilityCard({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: readonly FormatCapabilityEntry[];
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-semibold text-[var(--ink-strong)]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-body)]">{description}</p>

      <div className="mt-5 space-y-4">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface-base)] p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--ink-strong)]">
                  {entry.label}
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-body)]">
                  {entry.extensions.join(" / ")} · {entry.suitableFor}
                </p>
              </div>
            </div>

            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {Object.values(entry.capabilities).map((capability) => (
                <div
                  key={`${entry.id}-${capability.label}`}
                  className="rounded-2xl border border-[var(--border-soft)] bg-white/70 px-4 py-3"
                >
                  <dt className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--ink-strong)]">
                    <span>{capability.label}</span>
                    <span className="rounded-full bg-[var(--surface-accent)] px-2.5 py-1 text-xs text-[var(--accent-strong)]">
                      {getCapabilityStateLabel(capability.state)}
                    </span>
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
                    {capability.description}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
