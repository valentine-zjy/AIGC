import type { TaskDetailData } from "@ai-rewrite/contracts";

import { buildTaskStatusViewModel } from "./task-status-copy";

function getStageClasses(state: "completed" | "current" | "upcoming" | "failed") {
  switch (state) {
    case "completed":
      return {
        badge:
          "border-emerald-300 bg-emerald-50 text-emerald-700",
        card:
          "border-emerald-200 bg-emerald-50/70",
      };
    case "current":
      return {
        badge:
          "border-[var(--accent-soft)] bg-[var(--surface-accent)] text-[var(--ink-strong)]",
        card:
          "border-[var(--accent-soft)] bg-[var(--surface-accent)]",
      };
    case "failed":
      return {
        badge:
          "border-rose-300 bg-rose-50 text-rose-700",
        card:
          "border-rose-200 bg-rose-50/80",
      };
    case "upcoming":
      return {
        badge:
          "border-[var(--border-soft)] bg-white text-[var(--ink-muted)]",
        card:
          "border-[var(--border-soft)] bg-white/80",
      };
  }
}

export function TaskStatusRail({ task }: { task: TaskDetailData }) {
  const viewModel = buildTaskStatusViewModel(task);

  return (
    <section
      aria-labelledby="task-status-rail-title"
      className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            处理状态轨道
          </p>
          <h2
            id="task-status-rail-title"
            className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]"
          >
            {viewModel.headline}
          </h2>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink-body)]">
          <span>{viewModel.statusLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{task.progressPercent}%</span>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-body)]">
        {viewModel.helper}
      </p>

      <ol className="mt-6 grid gap-4 md:grid-cols-5" aria-label="任务处理阶段轨道">
        {viewModel.stages.map((stage, index) => {
          const classes = getStageClasses(stage.state);

          return (
            <li
              key={stage.key}
              aria-label={stage.ariaLabel}
              className={`rounded-3xl border p-4 ${classes.card}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink-strong)]">
                    {stage.label}
                  </p>
                </div>
                <span
                  className={`inline-flex min-w-16 justify-center rounded-full border px-3 py-1 text-xs font-semibold ${classes.badge}`}
                >
                  {stage.stateText}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-body)]">
                {stage.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}