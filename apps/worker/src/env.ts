import { z } from "zod";

const workerEnvSchema = z.object({
  AI_REWRITE_WORKER_STAGE_DELAY_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(600),
  AI_REWRITE_WORKER_POLL_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(500),
});

export type WorkerEnv = {
  stageDelayMs: number;
  pollMs: number;
};

export function getWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = workerEnvSchema.parse(env);

  return {
    stageDelayMs: parsed.AI_REWRITE_WORKER_STAGE_DELAY_MS,
    pollMs: parsed.AI_REWRITE_WORKER_POLL_MS,
  };
}
