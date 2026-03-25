import { randomUUID } from "node:crypto";

import type {
  TaskAccessContext,
  BootstrapTaskContext,
} from "../../task-session.ts";
import {
  createTaskAccessContext,
  createTaskAccessToken,
} from "../../task-session.ts";

import type { UploadApiErrorCode, UploadAcceptedData } from "@ai-rewrite/contracts";
import { getTaskRepository, type TaskRepository } from "@ai-rewrite/db";
import {
  createTaskJobPayload,
  enqueueTaskJob,
  type TaskJobPayload,
} from "@ai-rewrite/queue";
import {
  getOriginalDocumentStorage,
  type OriginalDocumentStorage,
} from "@ai-rewrite/storage";

import { getUploadFeedbackCopy } from "./upload-feedback.ts";
import { inspectUploadFile, serverUploadSchema } from "./upload-schema.ts";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

type UploadRateLimitRecord = {
  count: number;
  windowStartedAt: number;
};

const uploadRateLimitStore = new Map<string, UploadRateLimitRecord>();

export type AcceptedUpload = {
  data: UploadAcceptedData;
  taskContext: TaskAccessContext;
};

export type RejectedUpload = {
  status: number;
  error: UploadApiErrorCode;
  message: string;
  nextStep: string;
};

function getQueuedTaskState() {
  return {
    status: "queued" as const,
    stage: "upload" as const,
    progressPercent: 12,
    statusMessage: "文档已上传，正在等待处理队列接手。",
    nextStep: "保持当前页面打开，系统会自动刷新任务阶段。",
    retryable: false,
  };
}

function getQueueFailureState() {
  return {
    status: "failed" as const,
    stage: "upload" as const,
    progressPercent: 12,
    statusMessage: "任务未能进入处理队列。",
    nextStep: "当前文档仍按默认保留期保存。请稍后重新上传同一份文档；如果问题持续，请联系支持。",
    retryable: true,
    failureCode: "queue_unavailable" as const,
    failureStage: "upload" as const,
    failureMessage: "处理队列当前不可用，任务尚未开始解析或扫描。",
  };
}

function getRateLimitKey({
  sessionId,
  clientIp,
}: {
  sessionId: string;
  clientIp: string | null;
}) {
  return `${sessionId}:${clientIp ?? "anonymous"}`;
}

function isRateLimited({
  sessionId,
  clientIp,
  now,
}: {
  sessionId: string;
  clientIp: string | null;
  now: number;
}) {
  const key = getRateLimitKey({ sessionId, clientIp });
  const existing = uploadRateLimitStore.get(key);

  if (!existing || now - existing.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
    uploadRateLimitStore.set(key, {
      count: 1,
      windowStartedAt: now,
    });

    return false;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  uploadRateLimitStore.set(key, {
    ...existing,
    count: existing.count + 1,
  });

  return false;
}

async function runVirusScanPlaceholder(file: File) {
  void file;

  return { clean: true as const };
}

function createRejectedUpload(error: UploadApiErrorCode): RejectedUpload {
  const feedback = getUploadFeedbackCopy(error);

  return {
    status:
      error === "rate_limited"
        ? 429
        : error === "upload_unavailable"
          ? 503
          : 400,
    error,
    message: feedback.detail,
    nextStep: feedback.nextStep,
  };
}

export async function acceptUploadSubmission({
  anonymousContext,
  file,
  clientIp,
  now = Date.now(),
  repository = getTaskRepository(),
  storage = getOriginalDocumentStorage(),
  enqueueTask = enqueueTaskJob,
}: {
  anonymousContext: BootstrapTaskContext;
  file: File | undefined;
  clientIp: string | null;
  now?: number;
  repository?: TaskRepository;
  storage?: OriginalDocumentStorage;
  enqueueTask?: (payload: TaskJobPayload) => Promise<unknown>;
}): Promise<AcceptedUpload | RejectedUpload> {
  const validation = inspectUploadFile(file, { allowEmptyMime: false });
  const firstIssue = validation.issues[0];

  if (firstIssue) {
    return createRejectedUpload(firstIssue.code);
  }

  if (!file) {
    return createRejectedUpload("missing_file");
  }

  const validated = serverUploadSchema.safeParse({
    mode: anonymousContext.mode,
    document: file,
  });

  if (!validated.success) {
    return createRejectedUpload("upload_unavailable");
  }

  if (
    isRateLimited({
      sessionId: anonymousContext.sessionId,
      clientIp,
      now,
    })
  ) {
    return createRejectedUpload("rate_limited");
  }

  const virusScanResult = await runVirusScanPlaceholder(file);

  if (!virusScanResult.clean) {
    return createRejectedUpload("upload_unavailable");
  }

  const taskId = `task_${randomUUID()}`;
  const { accessToken, accessTokenHash } = createTaskAccessToken();

  let storedDocument;

  try {
    storedDocument = await storage.storeOriginalDocument({
      taskId,
      sessionId: anonymousContext.sessionId,
      file,
    });
  } catch {
    return createRejectedUpload("upload_unavailable");
  }

  let taskRecord;

  try {
    taskRecord = await repository.createTaskRecord({
      taskId,
      sessionId: anonymousContext.sessionId,
      mode: anonymousContext.mode,
      ...getQueuedTaskState(),
      accessTokenHash,
      originalFileName: file.name,
      mimeType: storedDocument.contentType,
      byteSize: storedDocument.byteSize,
      checksumSha256: storedDocument.checksumSha256,
      bucketName: storedDocument.bucketName,
      objectKey: storedDocument.objectKey,
      storageProvider: storedDocument.storageProvider,
    });
  } catch {
    try {
      await storage.deleteOriginalDocument(storedDocument.objectKey);
    } catch {
      // Best effort cleanup. The API still returns an intake failure.
    }

    return createRejectedUpload("upload_unavailable");
  }

  try {
    await enqueueTask(
      createTaskJobPayload({
        taskId,
        sessionId: anonymousContext.sessionId,
        mode: anonymousContext.mode,
      }),
    );
  } catch {
    const failedTask = await repository
      .updateTaskRecordState({
        taskId,
        ...getQueueFailureState(),
      })
      .catch(() => null);

    if (!failedTask) {
      return createRejectedUpload("upload_unavailable");
    }

    taskRecord = failedTask;
  }

  return {
    data: {
      taskId,
      status: taskRecord.status,
      stage: taskRecord.stage,
      progressPercent: taskRecord.progressPercent,
      nextPath: `/tasks/${taskId}`,
      mode: anonymousContext.mode,
      message: taskRecord.statusMessage,
      fileName: file.name,
    },
    taskContext: createTaskAccessContext({
      sessionId: anonymousContext.sessionId,
      taskId,
      mode: anonymousContext.mode,
      accessToken,
    }),
  };
}

export function resetUploadRateLimitStore() {
  uploadRateLimitStore.clear();
}
