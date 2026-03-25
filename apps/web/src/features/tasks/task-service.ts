import {
  isTerminalTaskStatus,
  type TaskApiErrorCode,
  type TaskDetailData,
} from "@ai-rewrite/contracts";
import {
  getTaskRepository,
  getTaskRetentionDays,
  isTaskExpired,
  type TaskRecord,
  type TaskRepository,
} from "@ai-rewrite/db";

import {
  getTaskAccessTokenHash,
  isDeletedTaskContext,
  isTaskAccessContext,
  type StoredTaskContext,
} from "../../task-session.ts";
import { getServerEnv } from "../../lib/env/server-env.ts";
import { sharedAccessScopeCopy } from "../policies/data-governance-copy.ts";

const TASK_STATUS_POLL_INTERVAL_MS = 2_500;
const TASK_DELAY_THRESHOLD_MS = 20_000;

type TaskReadFailure = {
  status: 401 | 404 | 410;
  error: TaskApiErrorCode;
  message: string;
  nextStep: string;
};

function mapTaskRecordToDetail(task: TaskRecord): TaskDetailData {
  const env = getServerEnv();
  const updatedAtMs = Date.parse(task.updatedAt);
  const isDelayed =
    !isTerminalTaskStatus(task.status) &&
    Number.isFinite(updatedAtMs) &&
    Date.now() - updatedAtMs >= TASK_DELAY_THRESHOLD_MS;

  return {
    taskId: task.taskId,
    mode: task.mode,
    status: task.status,
    stage: task.stage,
    progressPercent: task.progressPercent,
    statusMessage: task.statusMessage,
    nextStep: task.nextStep,
    retryable: task.retryable,
    isDelayed,
    failure: task.failureCode
      ? {
          taskId: task.taskId,
          code: task.failureCode,
          stage: task.failureStage ?? task.stage,
          message: task.failureMessage ?? task.statusMessage,
          retryable: task.retryable,
          nextStep: task.nextStep,
        }
      : null,
    poll: {
      shouldPoll: !isTerminalTaskStatus(task.status),
      intervalMs: TASK_STATUS_POLL_INTERVAL_MS,
    },
    fileName: task.fileName,
    mimeType: task.mimeType,
    fileSize: task.fileSize,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    accessScope: sharedAccessScopeCopy,
    retentionDays: env.retentionDays,
    trainingUse: "excluded",
  };
}

function getUnauthorizedFailure(): TaskReadFailure {
  return {
    status: 401,
    error: "unauthorized_task_access",
    message:
      "当前任务上下文无权访问该任务。请从受信任的上传流程重新进入。",
    nextStep: "返回上传页重新建立任务上下文，或创建一个新任务。",
  };
}

function getDeletedFailure(): TaskReadFailure {
  return {
    status: 410,
    error: "task_deleted",
    message:
      "当前任务文档与相关处理数据已删除，链接不再可恢复访问。",
    nextStep: "返回上传页开始新的任务，或回到首页重新选择处理模式。",
  };
}

function getExpiredFailure(): TaskReadFailure {
  return {
    status: 410,
    error: "task_expired",
    message:
      "当前任务已超过默认保留期，系统已阻止继续访问该任务内容。",
    nextStep: "返回上传页重新上传文档；如需继续处理，请创建新任务。",
  };
}

function isStoredContextExpired(storedContext: StoredTaskContext) {
  return (
    Date.parse(storedContext.issuedAt) <=
    Date.now() - getTaskRetentionDays() * 24 * 60 * 60 * 1000
  );
}

export async function readAuthorizedTask({
  taskId,
  storedContext,
  repository = getTaskRepository(),
}: {
  taskId: string;
  storedContext: StoredTaskContext | null;
  repository?: TaskRepository;
}): Promise<{ data: TaskDetailData } | TaskReadFailure> {
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
    return isStoredContextExpired(storedContext)
      ? getExpiredFailure()
      : {
          status: 404,
          error: "task_not_found",
          message:
            "未找到该任务记录。它可能已经被删除，或未能完成初始入库。",
          nextStep: "返回上传流程重新创建任务。",
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

  return {
    data: mapTaskRecordToDetail(task),
  };
}
