import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import type {
  TaskSegmentConfidenceBucket,
  TaskSegmentContextStatus,
} from "@ai-rewrite/contracts";

import { getDatabaseClient } from "./client.ts";
import { getDatabaseRuntimeConfig } from "./env.ts";
import { documentSegments } from "./schema/document-segments.ts";

export type DocumentSegmentRecord = {
  segmentId: string;
  taskId: string;
  paragraphId: string;
  originalText: string;
  previousContext: string | null;
  nextContext: string | null;
  diagnosisReason: string;
  confidenceBucket: TaskSegmentConfidenceBucket;
  confidenceLabel: string;
  confidenceSummary: string;
  contextStatus: TaskSegmentContextStatus;
  contextStatusLabel: string;
  createdAt: string;
};

export type ReplaceTaskDocumentSegmentsInput = {
  taskId: string;
  createdAt?: Date;
  items: Array<{
    segmentId?: string;
    paragraphId: string;
    originalText: string;
    previousContext?: string | null;
    nextContext?: string | null;
    diagnosisReason: string;
    confidenceBucket: TaskSegmentConfidenceBucket;
    confidenceLabel: string;
    confidenceSummary: string;
    contextStatus: TaskSegmentContextStatus;
    contextStatusLabel: string;
    createdAt?: Date;
  }>;
};

export interface DocumentSegmentRepository {
  replaceTaskDocumentSegments(
    input: ReplaceTaskDocumentSegmentsInput,
  ): Promise<DocumentSegmentRecord[]>;
  findTaskDocumentSegment(input: {
    taskId: string;
    paragraphId: string;
  }): Promise<DocumentSegmentRecord | null>;
  deleteTaskDocumentSegments(taskId: string): Promise<void>;
}

const LOCAL_RUNTIME_ROOT = path.join(tmpdir(), "ai-rewrite-dev-runtime");
const LOCAL_SEGMENT_RUNTIME_DIR = path.join(LOCAL_RUNTIME_ROOT, "segments");

function getLocalSegmentFilePath(taskId: string) {
  return path.join(LOCAL_SEGMENT_RUNTIME_DIR, `${taskId}.json`);
}

async function ensureLocalSegmentRuntimeDir() {
  await mkdir(LOCAL_SEGMENT_RUNTIME_DIR, { recursive: true });
}

function buildDocumentSegmentRecord(
  taskId: string,
  item: ReplaceTaskDocumentSegmentsInput["items"][number],
  defaultCreatedAt: Date,
): DocumentSegmentRecord {
  return {
    segmentId: item.segmentId ?? randomUUID(),
    taskId,
    paragraphId: item.paragraphId,
    originalText: item.originalText,
    previousContext: item.previousContext ?? null,
    nextContext: item.nextContext ?? null,
    diagnosisReason: item.diagnosisReason,
    confidenceBucket: item.confidenceBucket,
    confidenceLabel: item.confidenceLabel,
    confidenceSummary: item.confidenceSummary,
    contextStatus: item.contextStatus,
    contextStatusLabel: item.contextStatusLabel,
    createdAt: (item.createdAt ?? defaultCreatedAt).toISOString(),
  };
}

function mapPersistedDocumentSegment(
  record: typeof documentSegments.$inferSelect,
): DocumentSegmentRecord {
  return {
    segmentId: record.segmentId,
    taskId: record.taskId,
    paragraphId: record.paragraphId,
    originalText: record.originalText,
    previousContext: record.previousContext,
    nextContext: record.nextContext,
    diagnosisReason: record.diagnosisReason,
    confidenceBucket: record.confidenceBucket,
    confidenceLabel: record.confidenceLabel,
    confidenceSummary: record.confidenceSummary,
    contextStatus: record.contextStatus,
    contextStatusLabel: record.contextStatusLabel,
    createdAt: record.createdAt.toISOString(),
  };
}

async function writeLocalDocumentSegments(
  taskId: string,
  records: DocumentSegmentRecord[],
) {
  await ensureLocalSegmentRuntimeDir();

  const filePath = getLocalSegmentFilePath(taskId);
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function readLocalDocumentSegments(
  taskId: string,
): Promise<DocumentSegmentRecord[]> {
  try {
    const payload = await readFile(getLocalSegmentFilePath(taskId), "utf8");

    return JSON.parse(payload) as DocumentSegmentRecord[];
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

export async function deleteLocalDocumentSegmentsForTask(taskId: string) {
  try {
    await unlink(getLocalSegmentFilePath(taskId));
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

function createMemoryDocumentSegmentRepository(): DocumentSegmentRepository {
  return {
    async replaceTaskDocumentSegments(input) {
      const createdAt = input.createdAt ?? new Date();
      const records = input.items.map((item) =>
        buildDocumentSegmentRecord(input.taskId, item, createdAt),
      );

      await writeLocalDocumentSegments(input.taskId, records);

      return records;
    },
    async findTaskDocumentSegment(input) {
      const records = await readLocalDocumentSegments(input.taskId);

      return (
        records.find((record) => record.paragraphId === input.paragraphId) ?? null
      );
    },
    async deleteTaskDocumentSegments(taskId) {
      await deleteLocalDocumentSegmentsForTask(taskId);
    },
  };
}

function createPostgresDocumentSegmentRepository(): DocumentSegmentRepository {
  const db = getDatabaseClient();

  return {
    async replaceTaskDocumentSegments(input) {
      const createdAt = input.createdAt ?? new Date();

      return db.transaction(async (tx) => {
        await tx
          .delete(documentSegments)
          .where(eq(documentSegments.taskId, input.taskId));

        if (input.items.length === 0) {
          return [];
        }

        const inserted = await tx
          .insert(documentSegments)
          .values(
            input.items.map((item) => ({
              segmentId: item.segmentId ?? randomUUID(),
              taskId: input.taskId,
              paragraphId: item.paragraphId,
              originalText: item.originalText,
              previousContext: item.previousContext ?? null,
              nextContext: item.nextContext ?? null,
              diagnosisReason: item.diagnosisReason,
              confidenceBucket: item.confidenceBucket,
              confidenceLabel: item.confidenceLabel,
              confidenceSummary: item.confidenceSummary,
              contextStatus: item.contextStatus,
              contextStatusLabel: item.contextStatusLabel,
              createdAt: item.createdAt ?? createdAt,
            })),
          )
          .returning();

        return inserted.map(mapPersistedDocumentSegment);
      });
    },
    async findTaskDocumentSegment(input) {
      const [record] = await db
        .select()
        .from(documentSegments)
        .where(
          and(
            eq(documentSegments.taskId, input.taskId),
            eq(documentSegments.paragraphId, input.paragraphId),
          ),
        )
        .limit(1);

      return record ? mapPersistedDocumentSegment(record) : null;
    },
    async deleteTaskDocumentSegments(taskId) {
      await db.delete(documentSegments).where(eq(documentSegments.taskId, taskId));
    },
  };
}

let cachedDocumentSegmentRepository: DocumentSegmentRepository | null = null;

export function getDocumentSegmentRepository(): DocumentSegmentRepository {
  if (cachedDocumentSegmentRepository) {
    return cachedDocumentSegmentRepository;
  }

  const config = getDatabaseRuntimeConfig(process.env);
  cachedDocumentSegmentRepository =
    config.driver === "postgres"
      ? createPostgresDocumentSegmentRepository()
      : createMemoryDocumentSegmentRepository();

  return cachedDocumentSegmentRepository;
}

export function resetDocumentSegmentRepositoryForTests() {
  cachedDocumentSegmentRepository = null;
}
