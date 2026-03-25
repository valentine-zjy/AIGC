import { getQueueRuntimeConfig } from "@ai-rewrite/queue";

import { startTaskQueueWorker } from "./queues/task-queue.ts";

const queueConfig = getQueueRuntimeConfig();
const worker = await startTaskQueueWorker();

console.log(
  `[worker] started with driver=${queueConfig.driver} queue=${queueConfig.queueName}`,
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void worker.close().finally(() => {
      process.exit(0);
    });
  });
}
