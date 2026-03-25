"use client";

import { useQuery } from "@tanstack/react-query";

import {
  taskErrorEnvelopeSchema,
  taskSegmentEnvelopeSchema,
  taskSegmentQuerySchema,
  type TaskSegmentData,
} from "@ai-rewrite/contracts";

export class TaskSegmentRequestError extends Error {
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

export function normalizeTaskSegmentQuery(paragraphId: string) {
  return taskSegmentQuerySchema.parse({ paragraphId });
}

export function buildTaskSegmentQueryKey(taskId: string, paragraphId: string) {
  const resolvedQuery = normalizeTaskSegmentQuery(paragraphId);

  return ["task-segment", taskId, resolvedQuery.paragraphId] as const;
}

export function buildTaskSegmentRequestPath(taskId: string, paragraphId: string) {
  const resolvedQuery = normalizeTaskSegmentQuery(paragraphId);
  const searchParams = new URLSearchParams({
    paragraphId: resolvedQuery.paragraphId,
  });

  return `/api/tasks/${taskId}/segments?${searchParams.toString()}`;
}

async function fetchTaskSegment(
  taskId: string,
  paragraphId: string,
): Promise<TaskSegmentData> {
  const response = await fetch(buildTaskSegmentRequestPath(taskId, paragraphId), {
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

    throw new TaskSegmentRequestError(
      parsedError.success
        ? parsedError.data.error.message
        : "段落诊断信息读取失败，请稍后刷新重试。",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.nextStep : undefined,
    );
  }

  const parsed = taskSegmentEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new TaskSegmentRequestError(
      "段落诊断响应格式无效，请稍后再试。",
      500,
    );
  }

  return parsed.data.data;
}

export function useTaskSegmentQuery({
  taskId,
  paragraphId,
  enabled = true,
}: {
  taskId: string;
  paragraphId: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["task-segment", taskId, paragraphId] as const,
    queryFn: () => fetchTaskSegment(taskId, normalizeTaskSegmentQuery(paragraphId ?? "").paragraphId),
    enabled: enabled && paragraphId !== null,
  });
}
