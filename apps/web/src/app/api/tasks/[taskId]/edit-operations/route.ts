import {
  createErrorEnvelope,
  createSuccessEnvelope,
  taskEditOperationHistoryQuerySchema,
  taskEditOperationInputSchema,
} from "@ai-rewrite/contracts";

import { readAuthorizedTaskEditHistory } from "../../../../../features/rewrites/task-edit-history-service.ts";
import { applyTaskEditOperationDecision } from "../../../../../features/rewrites/task-edit-operations-service.ts";
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

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const url = new URL(request.url);
  const parsedQuery = taskEditOperationHistoryQuerySchema.safeParse({
    paragraphId: url.searchParams.get("paragraphId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return Response.json(
      createErrorEnvelope({
        code: "invalid_task_edit_history_query",
        message: "The edit history query is invalid.",
        nextStep:
          "Refresh the page and try again, or reopen the paragraph from the workbench.",
      }),
      { status: 400 },
    );
  }

  const result = await readAuthorizedTaskEditHistory({
    taskId,
    paragraphId: parsedQuery.data.paragraphId,
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

  const parsedInput = taskEditOperationInputSchema.safeParse(body);

  if (!parsedInput.success) {
    return Response.json(
      createErrorEnvelope({
        code: "invalid_task_edit_operation",
        message:
          "The paragraph decision request is missing required fields or has an invalid shape.",
        nextStep:
          "Refresh the page, reselect the paragraph and rewrite option, then try again.",
      }),
      { status: 400 },
    );
  }

  const result = await applyTaskEditOperationDecision({
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