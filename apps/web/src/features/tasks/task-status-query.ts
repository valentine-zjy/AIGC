"use client";

import { useQuery } from "@tanstack/react-query";

import {
  isTerminalTaskStatus,
  taskDetailEnvelopeSchema,
  taskErrorEnvelopeSchema,
  type TaskDetailData,
} from "@ai-rewrite/contracts";

export class TaskStatusRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly nextStep?: string,
  ) {
    super(message);
  }
}

async function fetchTaskStatus(taskId: string): Promise<TaskDetailData> {
  const response = await fetch(`/api/tasks/${taskId}`, {
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

    throw new TaskStatusRequestError(
      parsedError.success
        ? parsedError.data.error.message
        : "任务状态读取失败，请稍后刷新重试。",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.nextStep : undefined,
    );
  }

  const parsed = taskDetailEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new TaskStatusRequestError(
      "任务状态响应格式无效，请稍后再试。",
      500,
    );
  }

  return parsed.data.data;
}

export function useTaskStatusQuery({
  taskId,
  initialTask,
  enabled = true,
}: {
  taskId: string;
  initialTask: TaskDetailData;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["task-status", taskId],
    queryFn: () => fetchTaskStatus(taskId),
    initialData: initialTask,
    enabled,
    refetchInterval: (query) => {
      if (!enabled) {
        return false;
      }

      const task = query.state.data;

      if (!task || isTerminalTaskStatus(task.status) || !task.poll.shouldPoll) {
        return false;
      }

      return task.poll.intervalMs;
    },
  });
}
