import { getQueueRuntimeConfig } from "./env.ts";
import { getTaskJobOptions } from "./retry-policy.ts";
import {
  enqueueMemoryTaskJob,
  getBullMqTaskQueue,
} from "./client.ts";
import {
  taskJobPayloadSchema,
  type TaskJobPayload,
} from "./queues.ts";

export type EnqueueTaskJobResult = {
  driver: "memory" | "bullmq";
  queueName: string;
  jobId: string;
};

export function createTaskJobPayload(
  payload: Omit<TaskJobPayload, "requestedAt"> & { requestedAt?: string },
): TaskJobPayload {
  return taskJobPayloadSchema.parse({
    ...payload,
    requestedAt: payload.requestedAt ?? new Date().toISOString(),
  });
}

export async function enqueueTaskJob(
  payload: TaskJobPayload,
  env: NodeJS.ProcessEnv = process.env,
): Promise<EnqueueTaskJobResult> {
  const parsed = taskJobPayloadSchema.parse(payload);
  const config = getQueueRuntimeConfig(env);

  if (config.driver === "memory") {
    return {
      driver: "memory",
      queueName: config.queueName,
      jobId: await enqueueMemoryTaskJob(parsed, config.queueName),
    };
  }

  const queue = getBullMqTaskQueue(env);
  const job = await queue.add("ingest-document", parsed, getTaskJobOptions());

  return {
    driver: "bullmq",
    queueName: config.queueName,
    jobId: job.id?.toString() ?? job.name,
  };
}