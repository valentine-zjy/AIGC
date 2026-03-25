import type { JobsOptions } from "bullmq";

export function getTaskJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  };
}
