import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq, lte } from "drizzle-orm";

import type {
  ProcessingMode,
  TaskFailureCode,
  TaskStage,
  TaskStatus,
} from "@ai-rewrite/contracts";

import { getDatabaseClient } from "./client.ts";
import { getDatabaseRuntimeConfig } from "./env.ts";
import { deleteLocalDocumentSegmentsForTask } from "./document-segments-repository.ts";
import { deleteLocalEditOperationsForTask } from "./edit-operations-repository.ts";
import { deleteLocalRewriteOptionsForTask } from "./rewrite-options-repository.ts";
import { deleteLocalRiskFindingsForTask } from "./risks-repository.ts";
import { documentAssets, documents, processingTasks } from "./schema/index.ts";

export type CreateTaskRecordInput = {
  taskId: string;
  sessionId: string;
  mode: ProcessingMode;
  status: TaskStatus;
  stage: TaskStage;
  progressPercent: number;
  statusMessage: string;
  nextStep: string;
  retryable: boolean;
  failureCode?: TaskFailureCode | null;
  failureStage?: TaskStage | null;
  failureMessage?: string | null;
  accessTokenHash: string;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  bucketName: string;
  objectKey: string;
  storageProvider: string;
  createdAt?: Date;
};

export type UpdateTaskRecordStateInput = {
  taskId: string;
  status: TaskStatus;
  stage: TaskStage;
  progressPercent: number;
  statusMessage: string;
  nextStep: string;
  retryable: boolean;
  failureCode?: TaskFailureCode | null;
  failureStage?: TaskStage | null;
  failureMessage?: string | null;
  updatedAt?: Date;
};

export type TaskRecord = {
  taskId: string;
  sessionId: string;
  mode: ProcessingMode;
  status: TaskStatus;
  stage: TaskStage;
  progressPercent: number;
  statusMessage: string;
  nextStep: string;
  retryable: boolean;
  failureCode: TaskFailureCode | null;
  failureStage: TaskStage | null;
  failureMessage: string | null;
  accessTokenHash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  bucketName: string;
  objectKey: string;
  storageProvider: string;
  createdAt: string;
  updatedAt: string;
};

export interface TaskRepository {
  createTaskRecord(input: CreateTaskRecordInput): Promise<TaskRecord>;
  findTaskRecordById(taskId: string): Promise<TaskRecord | null>;
  updateTaskRecordState(
    input: UpdateTaskRecordStateInput,
  ): Promise<TaskRecord | null>;
  deleteTaskRecord(taskId: string): Promise<TaskRecord | null>;
  listExpiredTaskRecords(cutoff: Date): Promise<TaskRecord[]>;
}

const LOCAL_RUNTIME_ROOT = path.join(tmpdir(), "ai-rewrite-dev-runtime");
const LOCAL_TASK_RUNTIME_DIR = path.join(LOCAL_RUNTIME_ROOT, "tasks");

function getLocalTaskFilePath(taskId: string) {
  return path.join(LOCAL_TASK_RUNTIME_DIR, `${taskId}.json`);
}

async function ensureLocalTaskRuntimeDir() {
  await mkdir(LOCAL_TASK_RUNTIME_DIR, { recursive: true });
}

async function writeLocalTaskRecord(record: TaskRecord) {
  await ensureLocalTaskRuntimeDir();

  const filePath = getLocalTaskFilePath(record.taskId);
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const serialized = JSON.stringify(record, null, 2);
  await writeFile(tempPath, serialized, "utf8");
  await rename(tempPath, filePath);
}

async function readLocalTaskRecord(taskId: string): Promise<TaskRecord | null> {
  try {
    const payload = await readFile(getLocalTaskFilePath(taskId), "utf8");

    return JSON.parse(payload) as TaskRecord;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

async function listLocalTaskRecords() {
  try {
    const entries = await readdir(LOCAL_TASK_RUNTIME_DIR, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const payload = await readFile(
            path.join(LOCAL_TASK_RUNTIME_DIR, entry.name),
            "utf8",
          );

          return JSON.parse(payload) as TaskRecord;
        }),
    );

    return records;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

function mapPersistedTaskRecord({
  task,
  document,
  asset,
}: {
  task: typeof processingTasks.$inferSelect;
  document: typeof documents.$inferSelect;
  asset: typeof documentAssets.$inferSelect;
}): TaskRecord {
  return {
    taskId: task.taskId,
    sessionId: task.sessionId,
    mode: task.mode,
    status: task.status,
    stage: task.stage,
    progressPercent: task.progressPercent,
    statusMessage: task.statusMessage,
    nextStep: task.nextStep,
    retryable: task.retryable,
    failureCode: task.failureCode,
    failureStage: task.failureStage,
    failureMessage: task.failureMessage,
    accessTokenHash: task.accessTokenHash,
    fileName: document.originalFileName,
    mimeType: document.mimeType,
    fileSize: document.byteSize,
    checksumSha256: asset.checksumSha256,
    bucketName: asset.bucketName,
    objectKey: asset.objectKey,
    storageProvider: asset.storageProvider,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

async function findDocumentBundleByTaskId(taskId: string) {
  const db = getDatabaseClient();
  const [task] = await db
    .select()
    .from(processingTasks)
    .where(eq(processingTasks.taskId, taskId))
    .limit(1);

  if (!task) {
    return null;
  }

  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, task.documentId))
    .limit(1);
  const [asset] = await db
    .select()
    .from(documentAssets)
    .where(eq(documentAssets.id, task.assetId))
    .limit(1);

  if (!document || !asset) {
    return null;
  }

  return { task, document, asset };
}

function createMemoryTaskRepository(): TaskRepository {
  return {
    async createTaskRecord(input) {
      const createdAt = input.createdAt ?? new Date();
      const record: TaskRecord = {
        taskId: input.taskId,
        sessionId: input.sessionId,
        mode: input.mode,
        status: input.status,
        stage: input.stage,
        progressPercent: input.progressPercent,
        statusMessage: input.statusMessage,
        nextStep: input.nextStep,
        retryable: input.retryable,
        failureCode: input.failureCode ?? null,
        failureStage: input.failureStage ?? null,
        failureMessage: input.failureMessage ?? null,
        accessTokenHash: input.accessTokenHash,
        fileName: input.originalFileName,
        mimeType: input.mimeType,
        fileSize: input.byteSize,
        checksumSha256: input.checksumSha256,
        bucketName: input.bucketName,
        objectKey: input.objectKey,
        storageProvider: input.storageProvider,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      };

      await writeLocalTaskRecord(record);

      return record;
    },
    async findTaskRecordById(taskId) {
      return readLocalTaskRecord(taskId);
    },
    async updateTaskRecordState(input) {
      const existing = await readLocalTaskRecord(input.taskId);

      if (!existing) {
        return null;
      }

      const nextRecord: TaskRecord = {
        ...existing,
        status: input.status,
        stage: input.stage,
        progressPercent: input.progressPercent,
        statusMessage: input.statusMessage,
        nextStep: input.nextStep,
        retryable: input.retryable,
        failureCode: input.failureCode ?? null,
        failureStage: input.failureStage ?? null,
        failureMessage: input.failureMessage ?? null,
        updatedAt: (input.updatedAt ?? new Date()).toISOString(),
      };

      await writeLocalTaskRecord(nextRecord);

      return nextRecord;
    },
    async deleteTaskRecord(taskId) {
      const existing = await readLocalTaskRecord(taskId);

      if (!existing) {
        return null;
      }

      await deleteLocalRiskFindingsForTask(taskId);
      await deleteLocalDocumentSegmentsForTask(taskId);
      await unlink(getLocalTaskFilePath(taskId));

      return existing;
    },
    async listExpiredTaskRecords(cutoff) {
      const records = await listLocalTaskRecords();
      const cutoffMs = cutoff.getTime();

      return records.filter((record) => Date.parse(record.createdAt) <= cutoffMs);
    },
  };
}

function createPostgresTaskRepository(): TaskRepository {
  const db = getDatabaseClient();

  return {
    async createTaskRecord(input) {
      const createdAt = input.createdAt ?? new Date();

      return db.transaction(async (tx) => {
        const [document] = await tx
          .insert(documents)
          .values({
            originalFileName: input.originalFileName,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            createdAt,
            updatedAt: createdAt,
          })
          .returning();

        const [asset] = await tx
          .insert(documentAssets)
          .values({
            documentId: document.id,
            storageProvider: input.storageProvider,
            bucketName: input.bucketName,
            objectKey: input.objectKey,
            checksumSha256: input.checksumSha256,
            contentType: input.mimeType,
            byteSize: input.byteSize,
            createdAt,
          })
          .returning();

        const [task] = await tx
          .insert(processingTasks)
          .values({
            taskId: input.taskId,
            sessionId: input.sessionId,
            mode: input.mode,
            status: input.status,
            stage: input.stage,
            progressPercent: input.progressPercent,
            statusMessage: input.statusMessage,
            nextStep: input.nextStep,
            retryable: input.retryable,
            failureCode: input.failureCode ?? null,
            failureStage: input.failureStage ?? null,
            failureMessage: input.failureMessage ?? null,
            accessTokenHash: input.accessTokenHash,
            documentId: document.id,
            assetId: asset.id,
            createdAt,
            updatedAt: createdAt,
          })
          .returning();

        return mapPersistedTaskRecord({ task, document, asset });
      });
    },
    async findTaskRecordById(taskId) {
      const bundle = await findDocumentBundleByTaskId(taskId);

      return bundle ? mapPersistedTaskRecord(bundle) : null;
    },
    async updateTaskRecordState(input) {
      const updatedAt = input.updatedAt ?? new Date();
      const [task] = await db
        .update(processingTasks)
        .set({
          status: input.status,
          stage: input.stage,
          progressPercent: input.progressPercent,
          statusMessage: input.statusMessage,
          nextStep: input.nextStep,
          retryable: input.retryable,
          failureCode: input.failureCode ?? null,
          failureStage: input.failureStage ?? null,
          failureMessage: input.failureMessage ?? null,
          updatedAt,
        })
        .where(eq(processingTasks.taskId, input.taskId))
        .returning();

      if (!task) {
        return null;
      }

      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, task.documentId))
        .limit(1);
      const [asset] = await db
        .select()
        .from(documentAssets)
        .where(eq(documentAssets.id, task.assetId))
        .limit(1);

      if (!document || !asset) {
        return null;
      }

      return mapPersistedTaskRecord({ task, document, asset });
    },
    async deleteTaskRecord(taskId) {
      return db.transaction(async (tx) => {
        const [task] = await tx
          .select()
          .from(processingTasks)
          .where(eq(processingTasks.taskId, taskId))
          .limit(1);

        if (!task) {
          return null;
        }

        const [document] = await tx
          .select()
          .from(documents)
          .where(eq(documents.id, task.documentId))
          .limit(1);
        const [asset] = await tx
          .select()
          .from(documentAssets)
          .where(eq(documentAssets.id, task.assetId))
          .limit(1);

        if (!document || !asset) {
          return null;
        }

        await tx
          .delete(processingTasks)
          .where(eq(processingTasks.taskId, taskId));
        await tx.delete(documentAssets).where(eq(documentAssets.id, asset.id));
        await tx.delete(documents).where(eq(documents.id, document.id));

        return mapPersistedTaskRecord({ task, document, asset });
      });
    },
    async listExpiredTaskRecords(cutoff) {
      const tasks = await db
        .select()
        .from(processingTasks)
        .where(lte(processingTasks.createdAt, cutoff));
      const records: TaskRecord[] = [];

      for (const task of tasks) {
        const [document] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, task.documentId))
          .limit(1);
        const [asset] = await db
          .select()
          .from(documentAssets)
          .where(eq(documentAssets.id, task.assetId))
          .limit(1);

        if (!document || !asset) {
          continue;
        }

        records.push(mapPersistedTaskRecord({ task, document, asset }));
      }

      return records;
    },
  };
}

let cachedRepository: TaskRepository | null = null;

export function getTaskRepository(): TaskRepository {
  if (cachedRepository) {
    return cachedRepository;
  }

  const config = getDatabaseRuntimeConfig(process.env);
  cachedRepository =
    config.driver === "postgres"
      ? createPostgresTaskRepository()
      : createMemoryTaskRepository();

  return cachedRepository;
}

export function resetTaskRepositoryForTests() {
  cachedRepository = null;
  rmSync(LOCAL_RUNTIME_ROOT, { recursive: true, force: true });
}
