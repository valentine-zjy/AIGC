"use client";

import {
  taskEditOperationInputSchema,
  taskEditOperationResultEnvelopeSchema,
  taskErrorEnvelopeSchema,
  type TaskEditDecisionAction,
  type TaskEditOperationResultData,
} from "@ai-rewrite/contracts";

export class TaskEditOperationRequestError extends Error {
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

export async function submitTaskEditOperationDecision({
  taskId,
  paragraphId,
  optionId,
  action,
}: {
  taskId: string;
  paragraphId: string;
  optionId: string;
  action: TaskEditDecisionAction;
}): Promise<TaskEditOperationResultData> {
  const payload = taskEditOperationInputSchema.parse({
    paragraphId,
    optionId,
    action,
  });

  const response = await fetch(`/api/tasks/${taskId}/edit-operations`, {
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

    throw new TaskEditOperationRequestError(
      parsedError.success
        ? parsedError.data.error.message
        : "Failed to submit the paragraph decision. Refresh and try again.",
      response.status,
      parsedError.success ? parsedError.data.error.code : undefined,
      parsedError.success ? parsedError.data.error.nextStep : undefined,
    );
  }

  const parsed = taskEditOperationResultEnvelopeSchema.safeParse(body);

  if (!parsed.success) {
    throw new TaskEditOperationRequestError(
      "The paragraph decision response is invalid. Refresh and try again.",
      500,
    );
  }

  return parsed.data.data;
}