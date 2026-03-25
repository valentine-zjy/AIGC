import {
  createTaskQueueWorker,
  drainMemoryTaskJobs,
  getQueueRuntimeConfig,
  type TaskJobPayload,
} from "@ai-rewrite/queue";

import { getWorkerEnv } from "../env.ts";
import { processTaskJob } from "../jobs/ingest-document.job.ts";

let activeMemoryDrain: Promise<number> | null = null;

export async function runMemoryTaskQueueOnce({
  jobs,
  failAtStage,
  stageDelayMs,
}: {
  jobs?: TaskJobPayload[];
  failAtStage?: "parse" | "scan";
  stageDelayMs?: number;
} = {}) {
  const resolvedJobs = jobs ?? (await drainMemoryTaskJobs());

  for (const job of resolvedJobs) {
    await processTaskJob(job, { failAtStage, stageDelayMs });
  }

  return resolvedJobs.length;
}

async function runMemoryTaskQueueSafely() {
  if (activeMemoryDrain) {
    return activeMemoryDrain;
  }

  activeMemoryDrain = runMemoryTaskQueueOnce().catch((error) => {
    console.error("[worker] memory queue processing failed", error);

    return 0;
  });

  try {
    return await activeMemoryDrain;
  } finally {
    activeMemoryDrain = null;
  }
}

export async function startTaskQueueWorker() {
  const queueConfig = getQueueRuntimeConfig();

  if (queueConfig.driver === "bullmq") {
    const worker = createTaskQueueWorker(async (payload) => {
      await processTaskJob(payload);
    });

    return {
      close: async () => {
        await worker.close();
      },
    };
  }

  const pollMs = getWorkerEnv().pollMs;
  const intervalHandle = setInterval(() => {
    void runMemoryTaskQueueSafely();
  }, pollMs);

  await runMemoryTaskQueueSafely();

  return {
    close: async () => {
      clearInterval(intervalHandle);
    },
  };
}