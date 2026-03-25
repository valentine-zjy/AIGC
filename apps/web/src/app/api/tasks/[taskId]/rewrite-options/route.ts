import {
  createErrorEnvelope,
  createSuccessEnvelope,
  taskRewriteOptionQuerySchema,
} from "@ai-rewrite/contracts";

import { readAuthorizedTaskRewriteOptions } from "../../../../../features/rewrites/task-rewrite-options-service.ts";
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
  const parsedQuery = taskRewriteOptionQuerySchema.safeParse({
    paragraphId: url.searchParams.get("paragraphId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return Response.json(
      createErrorEnvelope({
        code: "invalid_task_rewrite_query",
        message: "当前改写建议请求缺少有效的段落标识。",
        nextStep: "刷新当前页面后重试；如果问题持续，请重新选择高风险段落。",
      }),
      { status: 400 },
    );
  }

  const result = await readAuthorizedTaskRewriteOptions({
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