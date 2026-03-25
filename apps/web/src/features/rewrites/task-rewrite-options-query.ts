"use client";

import { useQuery } from "@tanstack/react-query";

import {
  taskErrorEnvelopeSchema,
  taskRewriteOptionEnvelopeSchema,
  taskRewriteOptionQuerySchema,
  type TaskRewriteOptionData,
} from "@ai-rewrite/contracts";

export class TaskRewriteOptionRequestError extends Error {
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

export function normalizeTaskRewriteOptionQuery(paragraphId: string) {
  return taskRewriteOptionQuerySchema.parse({ paragraphId });
}

export function buildTaskRewriteOptionsQueryKey(
  taskId: string,
  paragraphId: string,
) {
  const resolvedQuery = normalizeTaskRewriteOptionQuery(paragraphId);

  return ["task-rewrite-options", taskId, resolvedQuery.paragraphId] as const;
}

export function buildTaskRewriteOptionsRequestPath(
  taskId: string,
  paragraphId: string,
) {
  const resolvedQuery = normalizeTaskRewriteOptionQuery(paragraphId);
  const searchParams = new URLSearchParams({
    paragraphId: resolvedQuery.paragraphId,
  });

  return `/api/tasks/${taskId}/rewrite-options?${searchParams.toString()}`;
}

async function fetchTaskRewriteOptions(
  taskId: string,
  paragraphId: string,
): Promise<TaskRewriteOptionData> {
  const response = await fetch(
    buildTaskRewriteOptionsRequestPath(taskId, paragraphId),
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

    throw new TaskRewriteOptionRequestError(
      parsedError.success
        ? parsedError.data.error.message
        : "候选改写建议读取失败，请稍后刷新重试。",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.nextStep : undefined,
    );
  }

  const parsed = taskRewriteOptionEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new TaskRewriteOptionRequestError(
      "候选改写建议响应格式无效，请稍后再试。",
      500,
    );
  }

  return parsed.data.data;
}

export function useTaskRewriteOptionsQuery({
  taskId,
  paragraphId,
  enabled = true,
}: {
  taskId: string;
  paragraphId: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["task-rewrite-options", taskId, paragraphId] as const,
    queryFn: () =>
      fetchTaskRewriteOptions(
        taskId,
        normalizeTaskRewriteOptionQuery(paragraphId ?? "").paragraphId,
      ),
    enabled: enabled && paragraphId !== null,
    refetchInterval: (query) => {
      if (!enabled) {
        return false;
      }

      return query.state.data?.state === "pending" ? 2_500 : false;
    },
  });
}