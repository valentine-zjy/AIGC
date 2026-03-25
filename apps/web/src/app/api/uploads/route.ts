import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from "@ai-rewrite/contracts";

import {
  buildTaskContextCookie,
  isBootstrapTaskContext,
  parseStoredTaskContext,
  serializeTaskContext,
  TASK_CONTEXT_COOKIE,
} from "../../../task-session.ts";
import { getCookieValue } from "../../../lib/http/cookies.ts";
import { isMatchingCsrfToken, isTrustedMutationOrigin } from "../../../lib/security/csrf.ts";
import { getUploadFeedbackCopy } from "../../../features/upload/upload-feedback.ts";
import { acceptUploadSubmission } from "../../../features/upload/upload-service.ts";

function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function POST(request: Request) {
  const storedContext = parseStoredTaskContext(
    getCookieValue(request.headers.get("cookie"), TASK_CONTEXT_COOKIE),
  );

  if (!storedContext || !isBootstrapTaskContext(storedContext)) {
    const feedback = getUploadFeedbackCopy("missing_context");

    return Response.json(
      createErrorEnvelope({
        code: "missing_context",
        message: feedback.detail,
        nextStep: feedback.nextStep,
      }),
      { status: 401 },
    );
  }

  if (!isTrustedMutationOrigin(request)) {
    return Response.json(
      createErrorEnvelope({
        code: "csrf_invalid",
        message:
          "The upload request failed origin validation. Only same-origin trusted submissions can create tasks.",
        nextStep: "Reload the upload page and submit again from the trusted UI.",
      }),
      { status: 403 },
    );
  }

  const formData = await request.formData();

  if (
    !isMatchingCsrfToken({
      expected: storedContext.csrfToken,
      provided: formData.get("_csrf"),
    })
  ) {
    return Response.json(
      createErrorEnvelope({
        code: "csrf_invalid",
        message:
          "The upload request did not include the expected CSRF token for this anonymous task context.",
        nextStep: "Refresh the upload page to establish a new trusted submission context.",
      }),
      { status: 403 },
    );
  }

  const candidate = formData.get("document");
  const file = candidate instanceof File ? candidate : undefined;
  const result = await acceptUploadSubmission({
    anonymousContext: storedContext,
    file,
    clientIp: getClientIp(request),
  });

  if ("error" in result) {
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
    status: 202,
    headers: {
      "set-cookie": buildTaskContextCookie(
        serializeTaskContext(result.taskContext),
      ),
    },
  });
}
