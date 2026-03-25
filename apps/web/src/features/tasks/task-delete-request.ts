import {
  taskDeletedEnvelopeSchema,
  taskErrorEnvelopeSchema,
  type TaskApiErrorCode,
  type TaskDeletedData,
} from "@ai-rewrite/contracts";

export type TaskDeleteRequestResult =
  | {
      kind: "deleted";
      data: TaskDeletedData;
    }
  | {
      kind: "error";
      status: number;
      code: TaskApiErrorCode;
      message: string;
      nextStep?: string;
    };

export async function submitTaskDeleteRequest({
  taskId,
  csrfToken,
  fetchImpl = fetch,
}: {
  taskId: string;
  csrfToken: string;
  fetchImpl?: typeof fetch;
}): Promise<TaskDeleteRequestResult> {
  let response: Response;

  try {
    response = await fetchImpl(`/api/tasks/${taskId}`, {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "x-task-csrf": csrfToken,
      },
    });
  } catch {
    return {
      kind: "error",
      status: 503,
      code: "task_delete_failed",
      message: "删除请求未能发送成功，请稍后重试。",
      nextStep: "稍后重试删除；如果问题持续，请联系支持。",
    };
  }

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsedError = taskErrorEnvelopeSchema.safeParse(payload);

    return {
      kind: "error",
      status: response.status,
      code: parsedError.success ? parsedError.data.error.code : "task_delete_failed",
      message: parsedError.success
        ? parsedError.data.error.message
        : "删除响应格式无效，请稍后重试。",
      nextStep: parsedError.success ? parsedError.data.error.nextStep : undefined,
    };
  }

  const parsed = taskDeletedEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      kind: "error",
      status: 500,
      code: "task_delete_failed",
      message: "删除响应格式无效，请稍后重试。",
    };
  }

  return {
    kind: "deleted",
    data: parsed.data.data,
  };
}
