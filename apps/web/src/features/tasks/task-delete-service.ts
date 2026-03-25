import type {
  TaskApiErrorCode,
  TaskDeletedData,
} from "@ai-rewrite/contracts";
import {
  deleteTaskData,
  getTaskRepository,
  isTaskExpired,
  type TaskRepository,
} from "@ai-rewrite/db";
import {
  getOriginalDocumentStorage,
  type OriginalDocumentStorage,
} from "@ai-rewrite/storage";

import {
  createDeletedTaskContext,
  getTaskAccessTokenHash,
  isDeletedTaskContext,
  isTaskAccessContext,
  type DeletedTaskContext,
  type StoredTaskContext,
} from "../../task-session.ts";

export type DeleteTaskFailure = {
  status: 401 | 404 | 410 | 500;
  error: TaskApiErrorCode;
  message: string;
  nextStep: string;
};

export type DeleteTaskSuccess = {
  data: TaskDeletedData;
  deletedContext: DeletedTaskContext;
};

function getUnauthorizedFailure(): DeleteTaskFailure {
  return {
    status: 401,
    error: "unauthorized_task_access",
    message: "当前任务上下文无权删除该任务。",
    nextStep: "返回上传页重新建立可信任务上下文后再试。",
  };
}

function getDeletedFailure(): DeleteTaskFailure {
  return {
    status: 410,
    error: "task_deleted",
    message: "该任务已经删除，无法重复执行删除。",
    nextStep: "返回上传页创建新的任务。",
  };
}

function getExpiredFailure(): DeleteTaskFailure {
  return {
    status: 410,
    error: "task_expired",
    message: "该任务已超过默认保留期，当前不可继续访问或手动删除。",
    nextStep: "返回上传页重新上传文档，创建新的任务。",
  };
}

export async function deleteAuthorizedTask({
  taskId,
  storedContext,
  repository = getTaskRepository(),
  storage = getOriginalDocumentStorage(),
}: {
  taskId: string;
  storedContext: StoredTaskContext | null;
  repository?: TaskRepository;
  storage?: OriginalDocumentStorage;
}): Promise<DeleteTaskSuccess | DeleteTaskFailure> {
  if (!storedContext) {
    return getUnauthorizedFailure();
  }

  if (isDeletedTaskContext(storedContext)) {
    if (storedContext.taskId !== taskId) {
      return getUnauthorizedFailure();
    }

    return storedContext.reason === "expired"
      ? getExpiredFailure()
      : getDeletedFailure();
  }

  if (!isTaskAccessContext(storedContext)) {
    return getUnauthorizedFailure();
  }

  if (storedContext.taskId !== taskId) {
    return getUnauthorizedFailure();
  }

  const task = await repository.findTaskRecordById(taskId);

  if (!task) {
    return {
      status: 404,
      error: "task_not_found",
      message: "未找到该任务记录，无法继续执行删除。",
      nextStep: "返回上传页重新创建任务。",
    };
  }

  if (
    task.sessionId !== storedContext.sessionId ||
    task.accessTokenHash !== getTaskAccessTokenHash(storedContext.accessToken)
  ) {
    return getUnauthorizedFailure();
  }

  if (isTaskExpired(task)) {
    return getExpiredFailure();
  }

  const deleted = await deleteTaskData({
    task,
    reason: "user_requested",
    repository,
    storage,
  });

  if (!deleted.ok) {
    return {
      status: 500,
      error: "task_delete_failed",
      message: deleted.message,
      nextStep: deleted.nextStep,
    };
  }

  return {
    data: deleted.data,
    deletedContext: createDeletedTaskContext({
      sessionId: task.sessionId,
      taskId: task.taskId,
      mode: task.mode,
      reason: deleted.data.reason,
      deletedAt: deleted.data.deletedAt,
    }),
  };
}
