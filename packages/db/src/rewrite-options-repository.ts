import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { and, asc, eq } from "drizzle-orm";

import { getDatabaseClient } from "./client.ts";
import { getDatabaseRuntimeConfig } from "./env.ts";
import { rewriteOptions } from "./schema/rewrite-options.ts";

export type RewriteOptionRecord = {
  optionId: string;
  taskId: string;
  paragraphId: string;
  optionRank: number;
  title: string;
  strategyLabel: string;
  candidateText: string;
  rationale: string;
  diffSummary: string;
  isRecommended: boolean;
  createdAt: string;
};

export type ReplaceTaskRewriteOptionsInput = {
  taskId: string;
  createdAt?: Date;
  items: Array<{
    optionId?: string;
    paragraphId: string;
    optionRank: number;
    title: string;
    strategyLabel: string;
    candidateText: string;
    rationale: string;
    diffSummary: string;
    isRecommended: boolean;
    createdAt?: Date;
  }>;
};

export interface RewriteOptionRepository {
  replaceTaskRewriteOptions(
    input: ReplaceTaskRewriteOptionsInput,
  ): Promise<RewriteOptionRecord[]>;
  listTaskRewriteOptions(input: {
    taskId: string;
    paragraphId: string;
  }): Promise<RewriteOptionRecord[]>;
  deleteTaskRewriteOptions(taskId: string): Promise<void>;
}

const LOCAL_RUNTIME_ROOT = path.join(tmpdir(), "ai-rewrite-dev-runtime");
const LOCAL_REWRITE_RUNTIME_DIR = path.join(
  LOCAL_RUNTIME_ROOT,
  "rewrite-options",
);

function getLocalRewriteFilePath(taskId: string) {
  return path.join(LOCAL_REWRITE_RUNTIME_DIR, `${taskId}.json`);
}

async function ensureLocalRewriteRuntimeDir() {
  await mkdir(LOCAL_REWRITE_RUNTIME_DIR, { recursive: true });
}

function sortRewriteOptions(records: RewriteOptionRecord[]) {
  return [...records].sort((left, right) => {
    if (left.optionRank !== right.optionRank) {
      return left.optionRank - right.optionRank;
    }

    return left.createdAt.localeCompare(right.createdAt, "zh-CN");
  });
}

function buildRewriteOptionRecord(
  taskId: string,
  item: ReplaceTaskRewriteOptionsInput["items"][number],
  defaultCreatedAt: Date,
): RewriteOptionRecord {
  return {
    optionId: item.optionId ?? randomUUID(),
    taskId,
    paragraphId: item.paragraphId,
    optionRank: item.optionRank,
    title: item.title,
    strategyLabel: item.strategyLabel,
    candidateText: item.candidateText,
    rationale: item.rationale,
    diffSummary: item.diffSummary,
    isRecommended: item.isRecommended,
    createdAt: (item.createdAt ?? defaultCreatedAt).toISOString(),
  };
}

function mapPersistedRewriteOption(
  record: typeof rewriteOptions.$inferSelect,
): RewriteOptionRecord {
  return {
    optionId: record.optionId,
    taskId: record.taskId,
    paragraphId: record.paragraphId,
    optionRank: record.optionRank,
    title: record.title,
    strategyLabel: record.strategyLabel,
    candidateText: record.candidateText,
    rationale: record.rationale,
    diffSummary: record.diffSummary,
    isRecommended: record.isRecommended,
    createdAt: record.createdAt.toISOString(),
  };
}

async function writeLocalRewriteOptions(
  taskId: string,
  records: RewriteOptionRecord[],
) {
  await ensureLocalRewriteRuntimeDir();

  const filePath = getLocalRewriteFilePath(taskId);
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function readLocalRewriteOptions(
  taskId: string,
): Promise<RewriteOptionRecord[]> {
  try {
    const payload = await readFile(getLocalRewriteFilePath(taskId), "utf8");

    return JSON.parse(payload) as RewriteOptionRecord[];
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

export async function deleteLocalRewriteOptionsForTask(taskId: string) {
  try {
    await unlink(getLocalRewriteFilePath(taskId));
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

function createMemoryRewriteOptionRepository(): RewriteOptionRepository {
  return {
    async replaceTaskRewriteOptions(input) {
      const createdAt = input.createdAt ?? new Date();
      const records = sortRewriteOptions(
        input.items.map((item) =>
          buildRewriteOptionRecord(input.taskId, item, createdAt),
        ),
      );

      await writeLocalRewriteOptions(input.taskId, records);

      return records;
    },
    async listTaskRewriteOptions(input) {
      const records = await readLocalRewriteOptions(input.taskId);

      return sortRewriteOptions(
        records.filter((record) => record.paragraphId === input.paragraphId),
      );
    },
    async deleteTaskRewriteOptions(taskId) {
      await deleteLocalRewriteOptionsForTask(taskId);
    },
  };
}

function createPostgresRewriteOptionRepository(): RewriteOptionRepository {
  const db = getDatabaseClient();

  return {
    async replaceTaskRewriteOptions(input) {
      const createdAt = input.createdAt ?? new Date();

      return db.transaction(async (tx) => {
        await tx
          .delete(rewriteOptions)
          .where(eq(rewriteOptions.taskId, input.taskId));

        if (input.items.length === 0) {
          return [];
        }

        const inserted = await tx
          .insert(rewriteOptions)
          .values(
            input.items.map((item) => ({
              optionId: item.optionId ?? randomUUID(),
              taskId: input.taskId,
              paragraphId: item.paragraphId,
              optionRank: item.optionRank,
              title: item.title,
              strategyLabel: item.strategyLabel,
              candidateText: item.candidateText,
              rationale: item.rationale,
              diffSummary: item.diffSummary,
              isRecommended: item.isRecommended,
              createdAt: item.createdAt ?? createdAt,
            })),
          )
          .returning();

        return sortRewriteOptions(inserted.map(mapPersistedRewriteOption));
      });
    },
    async listTaskRewriteOptions(input) {
      const records = await db
        .select()
        .from(rewriteOptions)
        .where(
          and(
            eq(rewriteOptions.taskId, input.taskId),
            eq(rewriteOptions.paragraphId, input.paragraphId),
          ),
        )
        .orderBy(
          asc(rewriteOptions.optionRank),
          asc(rewriteOptions.createdAt),
        );

      return records.map(mapPersistedRewriteOption);
    },
    async deleteTaskRewriteOptions(taskId) {
      await db.delete(rewriteOptions).where(eq(rewriteOptions.taskId, taskId));
    },
  };
}

let cachedRewriteOptionRepository: RewriteOptionRepository | null = null;

export function getRewriteOptionRepository(): RewriteOptionRepository {
  if (cachedRewriteOptionRepository) {
    return cachedRewriteOptionRepository;
  }

  const config = getDatabaseRuntimeConfig(process.env);
  cachedRewriteOptionRepository =
    config.driver === "postgres"
      ? createPostgresRewriteOptionRepository()
      : createMemoryRewriteOptionRepository();

  return cachedRewriteOptionRepository;
}

export function resetRewriteOptionRepositoryForTests() {
  cachedRewriteOptionRepository = null;
}