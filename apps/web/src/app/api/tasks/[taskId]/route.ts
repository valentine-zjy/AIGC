import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from "@ai-rewrite/contracts";

import { readAuthorizedTask } from "../../../../features/tasks/task-service.ts";
import { deleteAuthorizedTask } from "../../../../features/tasks/task-delete-service.ts";
import { getCookieValue } from "../../../../lib/http/cookies.ts";
import {
  isMatchingCsrfToken,
  isTrustedMutationOrigin,
} from "../../../../lib/security/csrf.ts";
import {
  buildTaskContextCookie,
  isTaskAccessContext,
  parseStoredTaskContext,
  serializeTaskContext,
  TASK_CONTEXT_COOKIE,
} from "../../../../task-session.ts";

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
  const result = await readAuthorizedTask({
    taskId,
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const storedContext = getStoredContext(request);

  if (!isTrustedMutationOrigin(request)) {
    return Response.json(
      createErrorEnvelope({
        code: "csrf_invalid",
        message: "删除请求未通过同源校验，只允许来自当前站点的受信任操作。",
        nextStep: "刷新当前页面后，从任务页重新发起删除。",
      }),
      { status: 403 },
    );
  }

  if (
    isTaskAccessContext(storedContext) &&
    !isMatchingCsrfToken({
      expected: storedContext.csrfToken,
      provided: request.headers.get("x-task-csrf"),
    })
  ) {
    return Response.json(
      createErrorEnvelope({
        code: "csrf_invalid",
        message: "删除请求缺少当前任务上下文对应的 CSRF 令牌。",
        nextStep: "刷新任务页后重试删除。",
      }),
      { status: 403 },
    );
  }

  const result = await deleteAuthorizedTask({
    taskId,
    storedContext,
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
    headers: {
      "set-cookie": buildTaskContextCookie(
        serializeTaskContext(result.deletedContext),
      ),
    },
  });
}

