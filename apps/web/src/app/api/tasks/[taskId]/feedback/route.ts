import {
  createErrorEnvelope,
  createSuccessEnvelope,
  taskFeedbackInputSchema,
} from "@ai-rewrite/contracts";

import { applyTaskFeedback } from "../../../../../features/rewrites/task-feedback-service.ts";
import { getCookieValue } from "../../../../../lib/http/cookies.ts";
import {
  parseStoredTaskContext,
  TASK_CONTEXT_COOKIE,
} from "../../../../../task-session.ts";

function getStoredContext(request: Request) {
  return parseStoredTaskContext(
    getCookieValue(request.headers.get("cookie"), TASK_CONTEXT_COOKIE),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;

  let body: unknown = null;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsedInput = taskFeedbackInputSchema.safeParse(body);

  if (!parsedInput.success) {
    return Response.json(
      createErrorEnvelope({
        code: "invalid_task_feedback",
        message:
          "The paragraph feedback request is missing required fields or has an invalid shape.",
        nextStep:
          "Refresh the page, reopen the paragraph, and try the feedback action again.",
      }),
      { status: 400 },
    );
  }

  const result = await applyTaskFeedback({
    taskId,
    paragraphId: parsedInput.data.paragraphId,
    optionId: parsedInput.data.optionId,
    action: parsedInput.data.action,
    storedContext: getStoredContext(request),
  });

  if (!("data" in result)) {
    return Response.json(
      createErrorEnvelope({
        code: result.error,
        message: result.message,
        nextStep: result.nextStep,
      }),
      { status: result.status },
    );
  }

  return Response.json(createSuccessEnvelope(result.data), {
    status: 200,
  });
}