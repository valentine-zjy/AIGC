"use client";

import { useQuery } from "@tanstack/react-query";

import {
  taskErrorEnvelopeSchema,
  taskRiskListEnvelopeSchema,
  taskRiskQuerySchema,
  type TaskRiskFilterIssueType,
  type TaskRiskFilterLevel,
  type TaskRiskFilterStatus,
  type TaskRiskListData,
  type TaskRiskSortMode,
} from "@ai-rewrite/contracts";

export type TaskRiskQueryFilters = {
  riskLevel?: TaskRiskFilterLevel;
  status?: TaskRiskFilterStatus;
  issueType?: TaskRiskFilterIssueType;
  sortBy?: TaskRiskSortMode;
  limit?: number;
};

export class TaskRiskRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly nextStep?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    nextStep?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.nextStep = nextStep;
  }
}

export function normalizeTaskRiskQueryFilters(filters: TaskRiskQueryFilters = {}) {
  return taskRiskQuerySchema.parse(filters);
}

export function buildTaskRisksQueryKey(
  taskId: string,
  filters: TaskRiskQueryFilters = {},
) {
  const resolvedFilters = normalizeTaskRiskQueryFilters(filters);

  return ["task-risks", taskId, resolvedFilters] as const;
}

export function buildTaskRisksRequestPath(
  taskId: string,
  filters: TaskRiskQueryFilters = {},
) {
  const resolvedFilters = normalizeTaskRiskQueryFilters(filters);
  const searchParams = new URLSearchParams({
    limit: String(resolvedFilters.limit),
    sortBy: resolvedFilters.sortBy,
  });

  if (resolvedFilters.riskLevel !== "all") {
    searchParams.set("riskLevel", resolvedFilters.riskLevel);
  }

  if (resolvedFilters.status !== "all") {
    searchParams.set("status", resolvedFilters.status);
  }

  if (resolvedFilters.issueType !== "all") {
    searchParams.set("issueType", resolvedFilters.issueType);
  }

  return `/api/tasks/${taskId}/risks?${searchParams.toString()}`;
}

async function fetchTaskRisks(
  taskId: string,
  filters: TaskRiskQueryFilters,
): Promise<TaskRiskListData> {
  const response = await fetch(buildTaskRisksRequestPath(taskId, filters), {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsedError = taskErrorEnvelopeSchema.safeParse(payload);

    throw new TaskRiskRequestError(
      parsedError.success
        ? parsedError.data.error.message
        : "风险结果读取失败，请稍后刷新重试。",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.nextStep : undefined,
    );
  }

  const parsed = taskRiskListEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new TaskRiskRequestError(
      "风险结果响应格式无效，请稍后再试。",
      500,
    );
  }

  return parsed.data.data;
}

export function useTaskRisksQuery({
  taskId,
  filters,
  enabled = true,
}: {
  taskId: string;
  filters?: TaskRiskQueryFilters;
  enabled?: boolean;
}) {
  const resolvedFilters = normalizeTaskRiskQueryFilters(filters);

  return useQuery({
    queryKey: buildTaskRisksQueryKey(taskId, resolvedFilters),
    queryFn: () => fetchTaskRisks(taskId, resolvedFilters),
    enabled,
    refetchInterval: (query) => {
      if (!enabled) {
        return false;
      }

      return query.state.data?.state === "pending" ? 2_500 : false;
    },
  });
}