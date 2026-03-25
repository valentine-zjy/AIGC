"use client";

import { useEffect } from "react";

import type {
  TaskDetailData,
  TaskRiskFilterIssueType,
  TaskRiskFilterLevel,
  TaskRiskFilterStatus,
  TaskRiskListData,
  TaskRiskSortMode,
} from "@ai-rewrite/contracts";

import {
  TaskRiskRequestError,
  type TaskRiskQueryFilters,
  useTaskRisksQuery,
} from "../tasks/task-risks-query";
import {
  buildTaskFormatBoundaryNotice,
  isPdfMimeType,
} from "../tasks/task-format-boundary";
import {
  TaskSegmentRequestError,
  useTaskSegmentQuery,
} from "../tasks/task-segments-query";
import { useTaskStatusUiStore } from "../tasks/task-status-ui-store";
import {
  buildTaskRiskWorkbenchViewModel,
  handlingStatusLabels,
  issueTypeLabels,
  riskLevelLabels,
  segmentConfidenceLabels,
  segmentContextStatusLabels,
  sortModeLabels,
} from "./task-risk-workbench-view-model";
import { TaskRewriteComparator } from "../rewrites/task-rewrite-comparator";
import { TaskEditHistoryPanel } from "../rewrites/task-edit-history-panel";

const riskLevelFilterOptions: Array<{
  value: TaskRiskFilterLevel;
  label: string;
}> = [
  { value: "all", label: "All levels" },
  { value: "high", label: "High only" },
  { value: "medium", label: "Medium only" },
  { value: "low", label: "Low only" },
];

const handlingStatusFilterOptions: Array<{
  value: TaskRiskFilterStatus;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "ignored", label: "Ignored" },
];

const issueTypeFilterOptions: Array<{
  value: TaskRiskFilterIssueType;
  label: string;
}> = [
  { value: "all", label: "All issue types" },
  { value: "background_template", label: issueTypeLabels.background_template },
  { value: "method_boilerplate", label: issueTypeLabels.method_boilerplate },
  { value: "result_formula", label: issueTypeLabels.result_formula },
  { value: "conclusion_template", label: issueTypeLabels.conclusion_template },
];

const sortModeOptions: Array<{
  value: TaskRiskSortMode;
  label: string;
}> = [
  { value: "recommended", label: sortModeLabels.recommended },
  { value: "score_desc", label: sortModeLabels.score_desc },
  { value: "paragraph_asc", label: sortModeLabels.paragraph_asc },
];

function buildFallbackResult(
  taskId: string,
  filters: TaskRiskQueryFilters,
): TaskRiskListData {
  return {
    taskId,
    state: "pending",
    message: "Loading risk findings.",
    generatedAt: null,
    totalCount: 0,
    filters: {
      riskLevel: filters.riskLevel ?? "all",
      status: filters.status ?? "all",
      issueType: filters.issueType ?? "all",
      sortBy: filters.sortBy ?? "recommended",
      limit: filters.limit ?? 10,
    },
    items: [],
  };
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex flex-col gap-2 text-sm font-semibold text-[var(--ink-strong)]"
    >
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-2xl border border-[var(--border-strong)] bg-white px-4 py-3 text-sm font-medium text-[var(--ink-body)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TaskRiskWorkbench({
  taskId,
  taskStatus,
  taskFailure,
  mimeType,
}: {
  taskId: string;
  taskStatus: TaskDetailData["status"];
  taskFailure: TaskDetailData["failure"];
  mimeType: string;
}) {
  const filters = useTaskStatusUiStore((state) => state.filters);
  const selectedParagraphId = useTaskStatusUiStore(
    (state) => state.selectedParagraphId,
  );
  const panelMode = useTaskStatusUiStore((state) => state.panelMode);
  const setSelectedParagraphId = useTaskStatusUiStore(
    (state) => state.setSelectedParagraphId,
  );
  const setPanelMode = useTaskStatusUiStore((state) => state.setPanelMode);
  const setRiskLevelFilter = useTaskStatusUiStore(
    (state) => state.setRiskLevelFilter,
  );
  const setStatusFilter = useTaskStatusUiStore((state) => state.setStatusFilter);
  const setIssueTypeFilter = useTaskStatusUiStore(
    (state) => state.setIssueTypeFilter,
  );
  const setSortBy = useTaskStatusUiStore((state) => state.setSortBy);
  const resetFilters = useTaskStatusUiStore((state) => state.resetFilters);

  const riskQuery = useTaskRisksQuery({
    taskId,
    filters,
    enabled: taskStatus !== "failed",
  });
  const riskResult = riskQuery.data ?? buildFallbackResult(taskId, filters);
  const viewModel = buildTaskRiskWorkbenchViewModel({
    result: riskResult,
    selectedParagraphId,
  });
  const selectedFinding = viewModel.selectedFinding;
  const segmentQuery = useTaskSegmentQuery({
    taskId,
    paragraphId: selectedFinding?.paragraphId ?? null,
    enabled: taskStatus !== "failed",
  });
  const isPdfTask = isPdfMimeType(mimeType);
  const formatNotice = buildTaskFormatBoundaryNotice({
    mimeType,
    state: taskFailure
      ? "failed"
      : riskResult.state === "pending"
        ? "pending"
        : riskResult.items.length === 0
          ? "empty"
          : "ready",
  });

  useEffect(() => {
    if (riskResult.items.length === 0) {
      if (selectedParagraphId !== null) {
        setSelectedParagraphId(null);
      }
      return;
    }

    const hasSelection = riskResult.items.some(
      (item) => item.paragraphId === selectedParagraphId,
    );

    if (!hasSelection) {
      setSelectedParagraphId(riskResult.items[0].paragraphId);
    }
  }, [riskResult.items, selectedParagraphId, setSelectedParagraphId]);

  if (taskFailure) {
    return (
      <section className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
          Risk Workbench
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
          Scan did not complete successfully
        </h2>
        <p className="mt-3 text-sm leading-6 text-amber-900">
          The task failed during the {taskFailure.stage} stage. Resolve the failure first, then retry the workflow.
        </p>
        {formatNotice ? (
          <div className="mt-4 rounded-3xl border border-amber-300 bg-white/80 p-4 text-sm leading-6 text-amber-900">
            <p className="font-semibold text-amber-950">{formatNotice.title}</p>
            <p className="mt-2">{formatNotice.summary}</p>
            <p className="mt-2">{formatNotice.nextStep}</p>
          </div>
        ) : null}
      </section>
    );
  }

  if (riskQuery.error instanceof TaskRiskRequestError) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-800">
          Risk Workbench
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-rose-900">
          Failed to load risk results
        </h2>
        <p className="mt-3 text-sm leading-6 text-rose-700">
          {riskQuery.error.message}
        </p>
        <p className="mt-2 text-sm leading-6 text-rose-700">
          {riskQuery.error.nextStep ?? "Refresh the page and try again."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Risk Workbench
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
            {viewModel.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-body)]">
            {viewModel.description}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {riskResult.generatedAt
              ? `Generated at ${new Date(riskResult.generatedAt).toLocaleString("zh-CN")}`
              : "Results will appear here after scanning completes."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 xl:justify-end">
          <div className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-body)]">
            {viewModel.totalLabel}
          </div>
          <button
            type="button"
            onClick={() => void riskQuery.refetch()}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            {riskQuery.isFetching ? "Refreshing..." : "Refresh results"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.9fr)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            id="riskLevel"
            label="Risk level"
            value={filters.riskLevel}
            options={riskLevelFilterOptions}
            onChange={(value) => setRiskLevelFilter(value as TaskRiskFilterLevel)}
          />
          <FilterSelect
            id="issueType"
            label="Issue type"
            value={filters.issueType}
            options={issueTypeFilterOptions}
            onChange={(value) =>
              setIssueTypeFilter(value as TaskRiskFilterIssueType)
            }
          />
          <FilterSelect
            id="status"
            label="Handling status"
            value={filters.status}
            options={handlingStatusFilterOptions}
            onChange={(value) => setStatusFilter(value as TaskRiskFilterStatus)}
          />
          <FilterSelect
            id="sortBy"
            label="Sort mode"
            value={filters.sortBy}
            options={sortModeOptions}
            onChange={(value) => setSortBy(value as TaskRiskSortMode)}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3 xl:justify-end">
          <button
            type="button"
            onClick={() => setPanelMode("list")}
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition lg:hidden ${
              panelMode === "list"
                ? "bg-[var(--ink-strong)] text-white"
                : "border border-[var(--border-strong)] text-[var(--ink-strong)]"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setPanelMode("detail")}
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition lg:hidden ${
              panelMode === "detail"
                ? "bg-[var(--ink-strong)] text-white"
                : "border border-[var(--border-strong)] text-[var(--ink-strong)]"
            }`}
          >
            Detail
          </button>
          <button
            type="button"
            onClick={() => {
              resetFilters();
              setPanelMode("list");
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-accent)]"
          >
            Reset filters
          </button>
        </div>
      </div>

      {formatNotice ? (
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 text-sm leading-6 text-amber-900">
          <p className="font-semibold text-amber-950">{formatNotice.title}</p>
          <p className="mt-2">{formatNotice.summary}</p>
          <p className="mt-2">{formatNotice.nextStep}</p>
        </div>
      ) : null}

      {riskResult.state === "pending" ? (
        <div className="mt-6 rounded-3xl border border-sky-200 bg-sky-50/70 p-5 text-sm leading-6 text-sky-900">
          Risk scanning is still running. Keep this page open and the workbench will update automatically when results are ready.
        </div>
      ) : null}

      {riskResult.state === "ready" && riskResult.items.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 text-sm leading-6 text-[var(--ink-body)]">
          <p>No paragraphs match the current filter combination.</p>
          <p className="mt-2">
            {formatNotice
              ? formatNotice.nextStep
              : "Adjust filters or wait for more results to become available."}
          </p>
        </div>
      ) : null}

      {riskResult.items.length > 0 ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <div className="space-y-3">
            {riskResult.items.map((item, index) => {
              const isActive = item.paragraphId === selectedFinding?.paragraphId;

              return (
                <article
                  key={item.findingId}
                  className={`rounded-3xl border p-5 transition ${
                    isActive
                      ? "border-[var(--accent-strong)] bg-[var(--surface-accent)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-base)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--ink-strong)]">
                    <span className="inline-flex rounded-full bg-[var(--surface-elevated)] px-3 py-1">
                      Top {index + 1}
                    </span>
                    <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-rose-800">
                      {riskLevelLabels[item.riskLevel]}
                    </span>
                    <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sky-900">
                      {item.issueTypeLabel}
                    </span>
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                      {handlingStatusLabels[item.handlingStatus]}
                    </span>
                    {isPdfTask ? (
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-slate-800">
                        PDF read-only
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <p className="text-base font-semibold text-[var(--ink-strong)]">
                      {item.issueTypeSummary}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
                      {item.excerpt}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                      {item.paragraphId} · score {item.score}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParagraphId(item.paragraphId);
                        setPanelMode("list");
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-white"
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedParagraphId(item.paragraphId);
                        setPanelMode("detail");
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)]"
                    >
                      Open detail
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside
            className={`${panelMode === "detail" ? "block" : "hidden"} rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 lg:block`}
            aria-live="polite"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Paragraph detail
            </p>
            {selectedFinding ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-[var(--ink-strong)]">
                  <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-rose-800">
                    {viewModel.selectedRiskLevelLabel}
                  </span>
                  <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sky-900">
                    {viewModel.selectedIssueTypeLabel}
                  </span>
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                    {viewModel.selectedHandlingStatusLabel}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-[var(--ink-strong)]">
                  {selectedFinding.issueTypeSummary}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                  Current paragraph: {selectedFinding.paragraphId}
                </p>

                {segmentQuery.error instanceof TaskSegmentRequestError ? (
                  <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm leading-6 text-rose-700">
                    <p className="font-semibold text-rose-900">Failed to load paragraph context</p>
                    <p className="mt-2">{segmentQuery.error.message}</p>
                    <p className="mt-2">
                      {segmentQuery.error.nextStep ?? "Refresh the page and try again."}
                    </p>
                  </div>
                ) : segmentQuery.isLoading || segmentQuery.data?.state === "pending" ? (
                  <div className="mt-5 rounded-3xl border border-sky-200 bg-sky-50/70 p-4 text-sm leading-6 text-sky-900">
                    {segmentQuery.data?.message ?? "Loading paragraph context and diagnostic notes."}
                  </div>
                ) : segmentQuery.data?.state === "unavailable" || !segmentQuery.data?.item ? (
                  <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-900">
                    <p className="font-semibold text-amber-950">Paragraph detail is temporarily unavailable</p>
                    <p className="mt-2">
                      {segmentQuery.data?.message ?? "The system has not returned full paragraph detail yet."}
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="flex flex-wrap gap-2 text-sm font-semibold text-[var(--ink-strong)]">
                      <span className="inline-flex rounded-full bg-[var(--surface-elevated)] px-3 py-1">
                        {segmentConfidenceLabels[
                          segmentQuery.data.item.confidenceBucket
                        ]}
                      </span>
                      <span className="inline-flex rounded-full bg-[var(--surface-elevated)] px-3 py-1">
                        {segmentContextStatusLabels[
                          segmentQuery.data.item.contextStatus
                        ]}
                      </span>
                      {isPdfTask ? (
                        <span className="inline-flex rounded-full bg-[var(--surface-elevated)] px-3 py-1">
                          PDF text extraction
                        </span>
                      ) : null}
                    </div>

                    <section aria-labelledby="diagnosis-original-text">
                      <h4
                        id="diagnosis-original-text"
                        className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
                      >
                        Original paragraph
                      </h4>
                      <p className="mt-2 rounded-3xl border border-[var(--border-soft)] bg-white p-4 text-sm leading-7 text-[var(--ink-body)]">
                        {segmentQuery.data.item.originalText}
                      </p>
                    </section>

                    <section aria-labelledby="diagnosis-context">
                      <h4
                        id="diagnosis-context"
                        className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
                      >
                        Context
                      </h4>
                      <div className="mt-2 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-3xl border border-[var(--border-soft)] bg-white p-4 text-sm leading-6 text-[var(--ink-body)]">
                          <p className="font-semibold text-[var(--ink-strong)]">Previous</p>
                          <p className="mt-2">
                            {segmentQuery.data.item.previousContext ?? "No previous context"}
                          </p>
                        </div>
                        <div className="rounded-3xl border border-[var(--border-soft)] bg-white p-4 text-sm leading-6 text-[var(--ink-body)]">
                          <p className="font-semibold text-[var(--ink-strong)]">Next</p>
                          <p className="mt-2">
                            {segmentQuery.data.item.nextContext ?? "No next context"}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section aria-labelledby="diagnosis-reason">
                      <h4
                        id="diagnosis-reason"
                        className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
                      >
                        Diagnosis reason
                      </h4>
                      <p className="mt-2 rounded-3xl border border-[var(--border-soft)] bg-white p-4 text-sm leading-7 text-[var(--ink-body)]">
                        {segmentQuery.data.item.diagnosisReason}
                      </p>
                    </section>

                    <section aria-labelledby="diagnosis-confidence">
                      <h4
                        id="diagnosis-confidence"
                        className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
                      >
                        Confidence
                      </h4>
                      <div className="mt-2 rounded-3xl border border-[var(--border-soft)] bg-white p-4 text-sm leading-6 text-[var(--ink-body)]">
                        <p className="font-semibold text-[var(--ink-strong)]">
                          {segmentQuery.data.item.confidenceLabel} · {segmentQuery.data.item.contextStatusLabel}
                        </p>
                        <p className="mt-2">
                          {segmentQuery.data.item.confidenceSummary}
                        </p>
                      </div>
                    </section>

                    <TaskRewriteComparator
                      taskId={taskId}
                      paragraphId={selectedFinding.paragraphId}
                      mimeType={mimeType}
                      originalText={segmentQuery.data.item.originalText}
                      currentHandlingStatus={selectedFinding.handlingStatus}
                      nextPendingParagraphId={viewModel.nextPendingParagraphId}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-5 rounded-3xl border border-[var(--border-soft)] bg-white p-4 text-sm leading-6 text-[var(--ink-body)]">
                Select one paragraph from the list to inspect its diagnosis panel.
              </div>
            )}
          </aside>

          <div className="lg:col-span-2 2xl:col-span-1">
            <TaskEditHistoryPanel
              taskId={taskId}
              selectedParagraphId={selectedFinding?.paragraphId ?? null}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}