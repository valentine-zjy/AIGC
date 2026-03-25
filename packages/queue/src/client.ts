import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Queue, Worker } from "bullmq";

import { getQueueRuntimeConfig } from "./env.ts";
import { taskJobPayloadSchema, type TaskJobPayload } from "./queues.ts";

type TaskJobProcessor = (payload: TaskJobPayload) => Promise<void>;

type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
};

type LocalTaskJobEnvelope = {
  jobId: string;
  queueName: string;
  enqueuedAt: string;
  payload: TaskJobPayload;
};

const LOCAL_QUEUE_ROOT_DIR = path.join(tmpdir(), "ai-rewrite-dev-runtime", "queue");
const LOCAL_QUEUE_PENDING_DIR = path.join(LOCAL_QUEUE_ROOT_DIR, "pending");
const LOCAL_QUEUE_PROCESSING_DIR = path.join(LOCAL_QUEUE_ROOT_DIR, "processing");
let cachedQueue: Queue<TaskJobPayload> | null = null;

function createRedisConnectionOptions(redisUrl: string): RedisConnectionOptions {
  const parsed = new URL(redisUrl);
  const dbFromPath = parsed.pathname && parsed.pathname !== "/"
    ? Number(parsed.pathname.slice(1))
    : undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(dbFromPath) ? dbFromPath : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

async function ensureLocalQueueRuntimeDirs() {
  await mkdir(LOCAL_QUEUE_PENDING_DIR, { recursive: true });
  await mkdir(LOCAL_QUEUE_PROCESSING_DIR, { recursive: true });
}

function getPendingJobFilePath(jobId: string) {
  return path.join(LOCAL_QUEUE_PENDING_DIR, `${jobId}.json`);
}

function getProcessingJobFilePath(jobId: string) {
  return path.join(LOCAL_QUEUE_PROCESSING_DIR, `${jobId}.json`);
}

export async function enqueueMemoryTaskJob(
  payload: TaskJobPayload,
  queueName: string,
) {
  await ensureLocalQueueRuntimeDirs();

  const jobId = `memory-${Date.now()}-${process.pid}-${randomUUID()}`;
  const envelope: LocalTaskJobEnvelope = {
    jobId,
    queueName,
    enqueuedAt: new Date().toISOString(),
    payload,
  };

  await writeFile(
    getPendingJobFilePath(jobId),
    JSON.stringify(envelope, null, 2),
    "utf8",
  );

  return jobId;
}

export async function drainMemoryTaskJobs(
  limit = Number.MAX_SAFE_INTEGER,
  queueName?: string,
) {
  await ensureLocalQueueRuntimeDirs();

  const pendingFiles = (await readdir(LOCAL_QUEUE_PENDING_DIR))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();
  const jobs: TaskJobPayload[] = [];

  for (const fileName of pendingFiles) {
    if (jobs.length >= limit) {
      break;
    }

    const jobId = fileName.slice(0, -5);
    const pendingPath = getPendingJobFilePath(jobId);
    const processingPath = getProcessingJobFilePath(jobId);

    try {
      await rename(pendingPath, processingPath);
      const payload = await readFile(processingPath, "utf8");
      const envelope = JSON.parse(payload) as LocalTaskJobEnvelope;

      if (queueName && envelope.queueName !== queueName) {
        await rename(processingPath, pendingPath);
        continue;
      }

      jobs.push(taskJobPayloadSchema.parse(envelope.payload));
      await rm(processingPath, { force: true });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }

      throw error;
    }
  }

  return jobs;
}

export function resetTaskQueueForTests() {
  cachedQueue = null;
  rmSync(LOCAL_QUEUE_ROOT_DIR, {
    recursive: true,
    force: true,
  });
}

export function getBullMqTaskQueue(env: NodeJS.ProcessEnv = process.env) {
  if (cachedQueue) {
    return cachedQueue;
  }

  const config = getQueueRuntimeConfig(env);

  if (config.driver !== "bullmq" || !config.redisUrl) {
    throw new Error("BullMQ queue is not available for the current runtime config.");
  }

  cachedQueue = new Queue<TaskJobPayload>(config.queueName, {
    connection: createRedisConnectionOptions(config.redisUrl),
  });

  return cachedQueue;
}

export function createTaskQueueWorker(
  processor: TaskJobProcessor,
  env: NodeJS.ProcessEnv = process.env,
) {
  const config = getQueueRuntimeConfig(env);

  if (config.driver !== "bullmq" || !config.redisUrl) {
    throw new Error("BullMQ worker is not available for the current runtime config.");
  }

  return new Worker<TaskJobPayload>(
    config.queueName,
    async (job) => processor(taskJobPayloadSchema.parse(job.data)),
    {
      connection: createRedisConnectionOptions(config.redisUrl),
      concurrency: config.concurrency,
    },
  );
}
