"use client";

import {
  taskErrorEnvelopeSchema,
  taskFeedbackInputSchema,
  taskFeedbackResultEnvelopeSchema,
  type TaskFeedbackAction,
  type TaskFeedbackResultData,
} from "@ai-rewrite/contracts";

export class TaskFeedbackRequestError extends Error {
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

export async function submitTaskFeedbackAction({
  taskId,
  paragraphId,
  optionId,
  action,
}: {
  taskId: string;
  paragraphId: string;
  optionId?: string;
  action: TaskFeedbackAction;
}): Promise<TaskFeedbackResultData> {
  const payload = taskFeedbackInputSchema.parse({
    paragraphId,
    optionId,
    action,
  });

  const response = await fetch(`/api/tasks/${taskId}/feedback`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const parsedError = taskErrorEnvelopeSchema.safeParse(body);

    throw new TaskFeedbackRequestError(
      parsedError.success
        ? parsedError.data.error.message
        : "Failed to submit feedback for the paragraph. Refresh and try again.",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.nextStep : undefined,
    );
  }

  const parsed = taskFeedbackResultEnvelopeSchema.safeParse(body);

  if (!parsed.success) {
    throw new TaskFeedbackRequestError(
      "The feedback response is invalid. Refresh and try again.",
      500,
    );
  }

  return parsed.data.data;
}