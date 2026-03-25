import {
  createErrorEnvelope,
  createSuccessEnvelope,
  taskSegmentQuerySchema,
} from "@ai-rewrite/contracts";

import { readAuthorizedTaskSegment } from "../../../../../features/tasks/task-segments-service.ts";
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
  const parsedQuery = taskSegmentQuerySchema.safeParse({
    paragraphId: url.searchParams.get("paragraphId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return Response.json(
      createErrorEnvelope({
        code: "invalid_task_segment_query",
        message: "段落诊断请求缺少有效的 paragraphId。",
        nextStep: "请从风险列表重新选择一个段落后再试。",
      }),
      { status: 400 },
    );
  }

  const result = await readAuthorizedTaskSegment({
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
