"use client";

import { useQuery } from "@tanstack/react-query";

import {
  taskEditOperationHistoryEnvelopeSchema,
  taskEditOperationHistoryQuerySchema,
  taskErrorEnvelopeSchema,
  type TaskEditOperationHistoryData,
} from "@ai-rewrite/contracts";

export class TaskEditHistoryRequestError extends Error {
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

export function normalizeTaskEditHistoryQuery(paragraphId?: string | null) {
  return taskEditOperationHistoryQuerySchema.parse({
    paragraphId: paragraphId ?? undefined,
  });
}

export function buildTaskEditHistoryQueryKey(
  taskId: string,
  paragraphId?: string | null,
) {
  const resolvedQuery = normalizeTaskEditHistoryQuery(paragraphId);

  return [
    "task-edit-history",
    taskId,
    resolvedQuery.paragraphId ?? null,
  ] as const;
}

export function buildTaskEditHistoryRequestPath(
  taskId: string,
  paragraphId?: string | null,
) {
  const resolvedQuery = normalizeTaskEditHistoryQuery(paragraphId);
  const searchParams = new URLSearchParams();

  if (resolvedQuery.paragraphId) {
    searchParams.set("paragraphId", resolvedQuery.paragraphId);
  }

  const query = searchParams.toString();

  return query.length > 0
    ? `/api/tasks/${taskId}/edit-operations?${query}`
    : `/api/tasks/${taskId}/edit-operations`;
}

async function fetchTaskEditHistory(
  taskId: string,
  paragraphId?: string | null,
): Promise<TaskEditOperationHistoryData> {
  const response = await fetch(
    buildTaskEditHistoryRequestPath(taskId, paragraphId),
    {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    },
  );

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsedError = taskErrorEnvelopeSchema.safeParse(payload);

    throw new TaskEditHistoryRequestError(
      parsedError.success
        ? parsedError.data.error.message
        : "Failed to load edit history. Refresh and try again.",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.nextStep : undefined,
    );
  }

  const parsed = taskEditOperationHistoryEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new TaskEditHistoryRequestError(
      "The edit history response is invalid. Refresh and try again.",
      500,
    );
  }

  return parsed.data.data;
}

export function useTaskEditHistoryQuery({
  taskId,
  paragraphId,
  enabled = true,
}: {
  taskId: string;
  paragraphId?: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: buildTaskEditHistoryQueryKey(taskId, paragraphId),
    queryFn: () => fetchTaskEditHistory(taskId, paragraphId),
    enabled,
  });
}