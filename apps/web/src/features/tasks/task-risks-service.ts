import type {
  TaskRiskFilterIssueType,
  TaskRiskFilterLevel,
  TaskRiskFilterStatus,
  TaskRiskListData,
  TaskRiskSortMode,
} from "@ai-rewrite/contracts";
import {
  getRiskFindingRepository,
  getTaskRepository,
  type RiskFindingRepository,
  type TaskRepository,
} from "@ai-rewrite/db";

import type { StoredTaskContext } from "../../task-session.ts";
import { readAuthorizedTask } from "./task-service.ts";
import { isParagraphWorkbenchReady } from "./task-workbench-stage.ts";

export type TaskRiskReadFilters = {
  riskLevel?: TaskRiskFilterLevel;
  status?: TaskRiskFilterStatus;
  issueType?: TaskRiskFilterIssueType;
  sortBy?: TaskRiskSortMode;
  limit?: number;
};

function resolveTaskRiskFilters(filters: TaskRiskReadFilters = {}) {
  return {
    riskLevel: filters.riskLevel ?? "all",
    status: filters.status ?? "all",
    issueType: filters.issueType ?? "all",
    sortBy: filters.sortBy ?? "recommended",
    limit: filters.limit ?? 10,
  } as const;
}

export async function readAuthorizedTaskRisks({
  taskId,
  storedContext,
  filters,
  taskRepository = getTaskRepository(),
  riskRepository = getRiskFindingRepository(),
}: {
  taskId: string;
  storedContext: StoredTaskContext | null;
  filters?: TaskRiskReadFilters;
  taskRepository?: TaskRepository;
  riskRepository?: RiskFindingRepository;
}): Promise<
  | { data: TaskRiskListData }
  | Awaited<ReturnType<typeof readAuthorizedTask>>
> {
  const taskResult = await readAuthorizedTask({
    taskId,
    storedContext,
    repository: taskRepository,
  });

  if (!("data" in taskResult)) {
    return taskResult;
  }

  const resolvedFilters = resolveTaskRiskFilters(filters);
  const items = await riskRepository.listTaskRiskFindings({
    taskId,
    riskLevel:
      resolvedFilters.riskLevel === "all" ? undefined : resolvedFilters.riskLevel,
    issueType:
      resolvedFilters.issueType === "all" ? undefined : resolvedFilters.issueType,
    handlingStatus:
      resolvedFilters.status === "all" ? undefined : resolvedFilters.status,
    sortBy: resolvedFilters.sortBy,
    limit: resolvedFilters.limit,
  });

  if (!isParagraphWorkbenchReady(taskResult.data)) {
    return {
      data: {
        taskId,
        state: "pending",
        message:
          taskResult.data.status === "failed"
            ? "Risk scanning did not finish successfully, so the workbench results are unavailable."
            : "The system is still preparing paragraph workbench results. Keep this page open while the scan or one-click preview finishes.",
        generatedAt: null,
        totalCount: 0,
        filters: resolvedFilters,
        items: [],
      },
    };
  }

  const hasActiveFilter =
    resolvedFilters.riskLevel !== "all" ||
    resolvedFilters.status !== "all" ||
    resolvedFilters.issueType !== "all";

  return {
    data: {
      taskId,
      state: "ready",
      message:
        items.length > 0
          ? resolvedFilters.sortBy === "recommended"
            ? "Returned the high-risk paragraph list in the recommended review order."
            : "Returned the high-risk paragraph list using the current sort order."
          : hasActiveFilter
            ? "No risk results match the current filter combination."
            : "The task is ready, but there are no high-risk paragraphs to review right now.",
      generatedAt: items[0]?.createdAt ?? null,
      totalCount: items.length,
      filters: resolvedFilters,
      items,
    },
  };
}
