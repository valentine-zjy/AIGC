import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { and, asc, eq } from "drizzle-orm";

import type {
  TaskEditOperationType,
  TaskRiskHandlingStatus,
} from "@ai-rewrite/contracts";

import { getDatabaseClient } from "./client.ts";
import { getDatabaseRuntimeConfig } from "./env.ts";
import { editOperations } from "./schema/edit-operations.ts";

export type EditOperationRecord = {
  operationId: string;
  taskId: string;
  paragraphId: string;
  optionId: string | null;
  operationType: TaskEditOperationType;
  handlingStatus: TaskRiskHandlingStatus;
  appliedText: string | null;
  createdAt: string;
};

export interface EditOperationRepository {
  appendTaskEditOperation(input: {
    taskId: string;
    paragraphId: string;
    optionId?: string | null;
    operationType: TaskEditOperationType;
    handlingStatus: TaskRiskHandlingStatus;
    appliedText?: string | null;
    createdAt?: Date;
  }): Promise<EditOperationRecord>;
  listTaskEditOperations(input: {
    taskId: string;
    paragraphId?: string;
  }): Promise<EditOperationRecord[]>;
  deleteTaskEditOperations(taskId: string): Promise<void>;
}

const LOCAL_RUNTIME_ROOT = path.join(tmpdir(), "ai-rewrite-dev-runtime");
const LOCAL_EDIT_RUNTIME_DIR = path.join(LOCAL_RUNTIME_ROOT, "edit-operations");

function getLocalEditFilePath(taskId: string) {
  return path.join(LOCAL_EDIT_RUNTIME_DIR, `${taskId}.json`);
}

async function ensureLocalEditRuntimeDir() {
  await mkdir(LOCAL_EDIT_RUNTIME_DIR, { recursive: true });
}

function sortEditOperations(records: EditOperationRecord[]) {
  return [...records].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt, "zh-CN"),
  );
}

function mapPersistedEditOperation(
  record: typeof editOperations.$inferSelect,
): EditOperationRecord {
  return {
    operationId: record.operationId,
    taskId: record.taskId,
    paragraphId: record.paragraphId,
    optionId: record.optionId,
    operationType: record.operationType,
    handlingStatus: record.handlingStatus,
    appliedText: record.appliedText,
    createdAt: record.createdAt.toISOString(),
  };
}

async function readLocalEditOperations(
  taskId: string,
): Promise<EditOperationRecord[]> {
  try {
    const payload = await readFile(getLocalEditFilePath(taskId), "utf8");

    return JSON.parse(payload) as EditOperationRecord[];
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

async function writeLocalEditOperations(
  taskId: string,
  records: EditOperationRecord[],
) {
  await ensureLocalEditRuntimeDir();

  const filePath = getLocalEditFilePath(taskId);
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
  await rename(tempPath, filePath);
}

export async function deleteLocalEditOperationsForTask(taskId: string) {
  try {
    await unlink(getLocalEditFilePath(taskId));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

function createMemoryEditOperationRepository(): EditOperationRepository {
  return {
    async appendTaskEditOperation(input) {
      const records = await readLocalEditOperations(input.taskId);
      const nextRecord: EditOperationRecord = {
        operationId: randomUUID(),
        taskId: input.taskId,
        paragraphId: input.paragraphId,
        optionId: input.optionId ?? null,
        operationType: input.operationType,
        handlingStatus: input.handlingStatus,
        appliedText: input.appliedText ?? null,
        createdAt: (input.createdAt ?? new Date()).toISOString(),
      };

      await writeLocalEditOperations(
        input.taskId,
        sortEditOperations([...records, nextRecord]),
      );

      return nextRecord;
    },
    async listTaskEditOperations(input) {
      const records = await readLocalEditOperations(input.taskId);
      const filtered = input.paragraphId
        ? records.filter((record) => record.paragraphId === input.paragraphId)
        : records;

      return sortEditOperations(filtered);
    },
    async deleteTaskEditOperations(taskId) {
      await deleteLocalEditOperationsForTask(taskId);
    },
  };
}

function createPostgresEditOperationRepository(): EditOperationRepository {
  const db = getDatabaseClient();

  return {
    async appendTaskEditOperation(input) {
      const [record] = await db
        .insert(editOperations)
        .values({
          operationId: randomUUID(),
          taskId: input.taskId,
          paragraphId: input.paragraphId,
          optionId: input.optionId ?? null,
          operationType: input.operationType,
          handlingStatus: input.handlingStatus,
          appliedText: input.appliedText ?? null,
          createdAt: input.createdAt ?? new Date(),
        })
        .returning();

      return mapPersistedEditOperation(record);
    },
    async listTaskEditOperations(input) {
      const filters = [eq(editOperations.taskId, input.taskId)];

      if (input.paragraphId) {
        filters.push(eq(editOperations.paragraphId, input.paragraphId));
      }

      const records = await db
        .select()
        .from(editOperations)
        .where(and(...filters))
        .orderBy(asc(editOperations.createdAt));

      return records.map(mapPersistedEditOperation);
    },
    async deleteTaskEditOperations(taskId) {
      await db.delete(editOperations).where(eq(editOperations.taskId, taskId));
    },
  };
}

let cachedEditOperationRepository: EditOperationRepository | null = null;

export function getEditOperationRepository(): EditOperationRepository {
  if (cachedEditOperationRepository) {
    return cachedEditOperationRepository;
  }

  const config = getDatabaseRuntimeConfig(process.env);
  cachedEditOperationRepository =
    config.driver === "postgres"
      ? createPostgresEditOperationRepository()
      : createMemoryEditOperationRepository();

  return cachedEditOperationRepository;
}

export function resetEditOperationRepositoryForTests() {
  cachedEditOperationRepository = null;
}