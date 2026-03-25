import { z } from "zod";

import { DEFAULT_TASK_QUEUE_NAME } from "./queues.ts";

const queueEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
  AI_REWRITE_QUEUE_DRIVER: z.enum(["memory", "bullmq"]).optional(),
  REDIS_URL: z.string().min(1).optional(),
  AI_REWRITE_QUEUE_NAME: z.string().min(1).optional(),
  AI_REWRITE_TASK_QUEUE_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(1),
});

export type QueueRuntimeConfig = {
  driver: "memory" | "bullmq";
  queueName: string;
  redisUrl: string | null;
  concurrency: number;
};

export function getQueueRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): QueueRuntimeConfig {
  const parsed = queueEnvSchema.parse(env);
  const driver =
    parsed.AI_REWRITE_QUEUE_DRIVER ??
    (parsed.REDIS_URL
      ? "bullmq"
      : parsed.NODE_ENV === "production"
        ? "bullmq"
        : "memory");

  if (driver === "bullmq" && !parsed.REDIS_URL) {
    throw new Error(
      "REDIS_URL is required when AI_REWRITE_QUEUE_DRIVER=bullmq or in production.",
    );
  }

  return {
    driver,
    queueName: parsed.AI_REWRITE_QUEUE_NAME ?? DEFAULT_TASK_QUEUE_NAME,
    redisUrl: parsed.REDIS_URL ?? null,
    concurrency: parsed.AI_REWRITE_TASK_QUEUE_CONCURRENCY,
  };
}
