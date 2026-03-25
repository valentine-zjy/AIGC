import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { and, asc, desc, eq } from "drizzle-orm";

import type {
  TaskRiskHandlingStatus,
  TaskRiskIssueType,
  TaskRiskLevel,
  TaskRiskSortMode,
} from "@ai-rewrite/contracts";

import { getDatabaseClient } from "./client.ts";
import { getDatabaseRuntimeConfig } from "./env.ts";
import { riskFindings } from "./schema/risk-findings.ts";

export type RiskFindingRecord = {
  findingId: string;
  taskId: string;
  paragraphId: string;
  riskLevel: TaskRiskLevel;
  issueType: TaskRiskIssueType;
  issueTypeLabel: string;
  issueTypeSummary: string;
  excerpt: string;
  score: number;
  handlingStatus: TaskRiskHandlingStatus;
  createdAt: string;
};

export type ReplaceTaskRiskFindingsInput = {
  taskId: string;
  createdAt?: Date;
  items: Array<{
    findingId?: string;
    paragraphId: string;
    riskLevel: TaskRiskLevel;
    issueType: TaskRiskIssueType;
    issueTypeLabel: string;
    issueTypeSummary: string;
    excerpt: string;
    score: number;
    handlingStatus: TaskRiskHandlingStatus;
    createdAt?: Date;
  }>;
};

export type ListTaskRiskFindingsInput = {
  taskId: string;
  riskLevel?: TaskRiskLevel;
  issueType?: TaskRiskIssueType;
  handlingStatus?: TaskRiskHandlingStatus;
  sortBy?: TaskRiskSortMode;
  limit?: number;
};

export interface RiskFindingRepository {
  replaceTaskRiskFindings(
    input: ReplaceTaskRiskFindingsInput,
  ): Promise<RiskFindingRecord[]>;
  listTaskRiskFindings(
    input: ListTaskRiskFindingsInput,
  ): Promise<RiskFindingRecord[]>;
  updateTaskRiskFindingHandlingStatus(input: {
    taskId: string;
    paragraphId: string;
    handlingStatus: TaskRiskHandlingStatus;
  }): Promise<RiskFindingRecord | null>;
  deleteTaskRiskFindings(taskId: string): Promise<void>;
}

const LOCAL_RUNTIME_ROOT = path.join(tmpdir(), "ai-rewrite-dev-runtime");
const LOCAL_RISK_RUNTIME_DIR = path.join(LOCAL_RUNTIME_ROOT, "risks");

function getLocalRiskFilePath(taskId: string) {
  return path.join(LOCAL_RISK_RUNTIME_DIR, `${taskId}.json`);
}

async function ensureLocalRiskRuntimeDir() {
  await mkdir(LOCAL_RISK_RUNTIME_DIR, { recursive: true });
}

function getRiskLevelWeight(riskLevel: TaskRiskLevel) {
  switch (riskLevel) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function getHandlingPriority(handlingStatus: TaskRiskHandlingStatus) {
  switch (handlingStatus) {
    case "pending":
      return 4;
    case "accepted":
      return 3;
    case "rejected":
      return 2;
    case "ignored":
      return 1;
  }
}

function sortRiskFindings(
  records: RiskFindingRecord[],
  sortBy: TaskRiskSortMode = "recommended",
) {
  const sorted = [...records];

  sorted.sort((left, right) => {
    if (sortBy === "paragraph_asc") {
      const byParagraph = left.paragraphId.localeCompare(
        right.paragraphId,
        "zh-CN",
      );

      if (byParagraph !== 0) {
        return byParagraph;
      }

      return right.score - left.score;
    }

    if (sortBy === "score_desc") {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.paragraphId.localeCompare(right.paragraphId, "zh-CN");
    }

    const byRisk = getRiskLevelWeight(right.riskLevel) - getRiskLevelWeight(left.riskLevel);

    if (byRisk !== 0) {
      return byRisk;
    }

    const byHandling =
      getHandlingPriority(right.handlingStatus) -
      getHandlingPriority(left.handlingStatus);

    if (byHandling !== 0) {
      return byHandling;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.paragraphId.localeCompare(right.paragraphId, "zh-CN");
  });

  return sorted;
}

async function writeLocalRiskFindings(taskId: string, records: RiskFindingRecord[]) {
  await ensureLocalRiskRuntimeDir();

  const filePath = getLocalRiskFilePath(taskId);
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function readLocalRiskFindings(taskId: string): Promise<RiskFindingRecord[]> {
  try {
    const payload = await readFile(getLocalRiskFilePath(taskId), "utf8");

    return JSON.parse(payload) as RiskFindingRecord[];
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

export async function deleteLocalRiskFindingsForTask(taskId: string) {
  try {
    await unlink(getLocalRiskFilePath(taskId));
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

function buildRiskFindingRecord(
  taskId: string,
  item: ReplaceTaskRiskFindingsInput["items"][number],
  defaultCreatedAt: Date,
): RiskFindingRecord {
  return {
    findingId: item.findingId ?? randomUUID(),
    taskId,
    paragraphId: item.paragraphId,
    riskLevel: item.riskLevel,
    issueType: item.issueType,
    issueTypeLabel: item.issueTypeLabel,
    issueTypeSummary: item.issueTypeSummary,
    excerpt: item.excerpt,
    score: item.score,
    handlingStatus: item.handlingStatus,
    createdAt: (item.createdAt ?? defaultCreatedAt).toISOString(),
  };
}

function mapPersistedRiskFinding(
  record: typeof riskFindings.$inferSelect,
): RiskFindingRecord {
  return {
    findingId: record.findingId,
    taskId: record.taskId,
    paragraphId: record.paragraphId,
    riskLevel: record.riskLevel,
    issueType: record.issueType,
    issueTypeLabel: record.issueTypeLabel,
    issueTypeSummary: record.issueTypeSummary,
    excerpt: record.excerpt,
    score: record.score,
    handlingStatus: record.handlingStatus,
    createdAt: record.createdAt.toISOString(),
  };
}

function createMemoryRiskFindingRepository(): RiskFindingRepository {
  return {
    async replaceTaskRiskFindings(input) {
      const createdAt = input.createdAt ?? new Date();
      const records = sortRiskFindings(
        input.items.map((item) =>
          buildRiskFindingRecord(input.taskId, item, createdAt),
        ),
        "recommended",
      );

      await writeLocalRiskFindings(input.taskId, records);

      return records;
    },
    async listTaskRiskFindings(input) {
      const records = await readLocalRiskFindings(input.taskId);

      return sortRiskFindings(
        records
          .filter((record) =>
            input.riskLevel ? record.riskLevel === input.riskLevel : true,
          )
          .filter((record) =>
            input.issueType ? record.issueType === input.issueType : true,
          )
          .filter((record) =>
            input.handlingStatus
              ? record.handlingStatus === input.handlingStatus
              : true,
          ),
        input.sortBy,
      ).slice(0, input.limit ?? Number.MAX_SAFE_INTEGER);
    },
    async updateTaskRiskFindingHandlingStatus(input) {
      const records = await readLocalRiskFindings(input.taskId);
      let updatedRecord = null;
      const nextRecords = records.map((record) => {
        if (record.paragraphId !== input.paragraphId) {
          return record;
        }

        updatedRecord = {
          ...record,
          handlingStatus: input.handlingStatus,
        };

        return updatedRecord;
      });

      if (!updatedRecord) {
        return null;
      }

      await writeLocalRiskFindings(input.taskId, nextRecords);

      return updatedRecord;
    },
    async deleteTaskRiskFindings(taskId) {
      await deleteLocalRiskFindingsForTask(taskId);
    },
  };
}

function createPostgresRiskFindingRepository(): RiskFindingRepository {
  const db = getDatabaseClient();

  return {
    async replaceTaskRiskFindings(input) {
      const createdAt = input.createdAt ?? new Date();

      return db.transaction(async (tx) => {
        await tx.delete(riskFindings).where(eq(riskFindings.taskId, input.taskId));

        if (input.items.length === 0) {
          return [];
        }

        const inserted = await tx
          .insert(riskFindings)
          .values(
            input.items.map((item) => ({
              findingId: item.findingId ?? randomUUID(),
              taskId: input.taskId,
              paragraphId: item.paragraphId,
              riskLevel: item.riskLevel,
              issueType: item.issueType,
              issueTypeLabel: item.issueTypeLabel,
              issueTypeSummary: item.issueTypeSummary,
              excerpt: item.excerpt,
              score: item.score,
              handlingStatus: item.handlingStatus,
              createdAt: item.createdAt ?? createdAt,
            })),
          )
          .returning();

        return sortRiskFindings(inserted.map(mapPersistedRiskFinding));
      });
    },
    async listTaskRiskFindings(input) {
      const filters = [eq(riskFindings.taskId, input.taskId)];

      if (input.riskLevel) {
        filters.push(eq(riskFindings.riskLevel, input.riskLevel));
      }

      if (input.issueType) {
        filters.push(eq(riskFindings.issueType, input.issueType));
      }

      if (input.handlingStatus) {
        filters.push(eq(riskFindings.handlingStatus, input.handlingStatus));
      }

      const records = await db
        .select()
        .from(riskFindings)
        .where(and(...filters))
        .orderBy(
          desc(riskFindings.createdAt),
          asc(riskFindings.paragraphId),
        );

      return sortRiskFindings(records.map(mapPersistedRiskFinding), input.sortBy)
        .slice(0, input.limit ?? Number.MAX_SAFE_INTEGER);
    },
    async updateTaskRiskFindingHandlingStatus(input) {
      const [record] = await db
        .update(riskFindings)
        .set({
          handlingStatus: input.handlingStatus,
        })
        .where(
          and(
            eq(riskFindings.taskId, input.taskId),
            eq(riskFindings.paragraphId, input.paragraphId),
          ),
        )
        .returning();

      return record ? mapPersistedRiskFinding(record) : null;
    },
    async deleteTaskRiskFindings(taskId) {
      await db.delete(riskFindings).where(eq(riskFindings.taskId, taskId));
    },
  };
}

let cachedRiskFindingRepository: RiskFindingRepository | null = null;

export function getRiskFindingRepository(): RiskFindingRepository {
  if (cachedRiskFindingRepository) {
    return cachedRiskFindingRepository;
  }

  const config = getDatabaseRuntimeConfig(process.env);
  cachedRiskFindingRepository =
    config.driver === "postgres"
      ? createPostgresRiskFindingRepository()
      : createMemoryRiskFindingRepository();

  return cachedRiskFindingRepository;
}

export function resetRiskFindingRepositoryForTests() {
  cachedRiskFindingRepository = null;
}