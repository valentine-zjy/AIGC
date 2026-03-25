import {
  createErrorEnvelope,
  createSuccessEnvelope,
  taskRiskQuerySchema,
} from "@ai-rewrite/contracts";

import { readAuthorizedTaskRisks } from "../../../../../features/tasks/task-risks-service.ts";
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
  const parsedFilters = taskRiskQuerySchema.safeParse({
    riskLevel: url.searchParams.get("riskLevel") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    issueType: url.searchParams.get("issueType") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  const result = await readAuthorizedTaskRisks({
    taskId,
    storedContext: getStoredContext(request),
    filters: parsedFilters.success ? parsedFilters.data : undefined,
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