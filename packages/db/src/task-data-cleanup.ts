import { z } from "zod";

import type {
  TaskDeletedData,
  TaskDeletionReason,
} from "@ai-rewrite/contracts";
import {
  getOriginalDocumentStorage,
  type OriginalDocumentStorage,
} from "@ai-rewrite/storage";

import { getTaskRepository, type TaskRecord, type TaskRepository } from "./task-repository.ts";

const retentionEnvSchema = z.coerce.number().int().positive().optional().default(7);

export type DeleteTaskDataResult =
  | {
      ok: true;
      data: TaskDeletedData;
      task: TaskRecord;
    }
  | {
      ok: false;
      message: string;
      nextStep: string;
    };

export function getTaskRetentionDays(env: NodeJS.ProcessEnv = process.env) {
  return retentionEnvSchema.parse(env.AI_REWRITE_RETENTION_DAYS);
}

export function getTaskRetentionCutoff({
  now = new Date(),
  retentionDays = getTaskRetentionDays(),
}: {
  now?: Date;
  retentionDays?: number;
} = {}) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function isTaskExpired(
  task: Pick<TaskRecord, "createdAt">,
  {
    now = new Date(),
    retentionDays = getTaskRetentionDays(),
  }: {
    now?: Date;
    retentionDays?: number;
  } = {},
) {
  return Date.parse(task.createdAt) <= getTaskRetentionCutoff({ now, retentionDays }).getTime();
}

export async function deleteTaskData({
  task,
  reason,
  repository = getTaskRepository(),
  storage = getOriginalDocumentStorage(),
  now = new Date(),
}: {
  task: TaskRecord;
  reason: TaskDeletionReason;
  repository?: TaskRepository;
  storage?: OriginalDocumentStorage;
  now?: Date;
}): Promise<DeleteTaskDataResult> {
  const deletedAt = now.toISOString();

  try {
    await storage.deleteOriginalDocument(task.objectKey);
  } catch {
    return {
      ok: false,
      message:
        reason === "expired"
          ? "任务已超过保留期，但系统在清理原始文件时失败，当前数据可能仍暂时存在。"
          : "系统未能删除原始文件，当前任务数据可能仍保留。",
      nextStep:
        reason === "expired"
          ? "稍后重新触发保留期清理，或联系支持排查对象存储删除失败。"
          : "稍后重试删除；如果问题持续，请联系支持。",
    };
  }

  try {
    const deletedRecord = await repository.deleteTaskRecord(task.taskId);

    if (!deletedRecord) {
      return {
        ok: false,
        message:
          "原始文件已删除，但任务记录清理未完成，当前任务可能暂时仍显示在系统中。",
        nextStep: "稍后重试删除；如果问题持续，请联系支持。",
      };
    }
  } catch {
    return {
      ok: false,
      message:
        "原始文件已删除，但任务记录清理未完成，当前任务可能暂时仍显示在系统中。",
      nextStep: "稍后重试删除；如果问题持续，请联系支持。",
    };
  }

  return {
    ok: true,
    task,
    data: {
      taskId: task.taskId,
      deletedAt,
      reason,
      message:
        reason === "expired"
          ? "任务已超过保留期并已完成不可恢复清理。"
          : "当前任务文档与相关处理数据已删除，后续将无法继续访问。",
      nextPath: "/upload",
    },
  };
}

export async function cleanupExpiredTasks({
  repository = getTaskRepository(),
  storage = getOriginalDocumentStorage(),
  now = new Date(),
  retentionDays = getTaskRetentionDays(),
}: {
  repository?: TaskRepository;
  storage?: OriginalDocumentStorage;
  now?: Date;
  retentionDays?: number;
} = {}) {
  const expiredTasks = await repository.listExpiredTaskRecords(
    getTaskRetentionCutoff({ now, retentionDays }),
  );
  const deletedTaskIds: string[] = [];
  const failedTaskIds: string[] = [];

  for (const task of expiredTasks) {
    const result = await deleteTaskData({
      task,
      reason: "expired",
      repository,
      storage,
      now,
    });

    if (result.ok) {
      deletedTaskIds.push(task.taskId);
    } else {
      failedTaskIds.push(task.taskId);
    }
  }

  return {
    scannedCount: expiredTasks.length,
    deletedTaskIds,
    failedTaskIds,
  };
}
