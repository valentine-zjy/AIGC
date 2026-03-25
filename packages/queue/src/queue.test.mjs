import assert from "node:assert/strict";

import {
  createTaskJobPayload,
  drainMemoryTaskJobs,
  enqueueTaskJob,
  getQueueRuntimeConfig,
  resetTaskQueueForTests,
} from "./index.ts";

const originalQueueDriver = process.env.AI_REWRITE_QUEUE_DRIVER;
const originalRedisUrl = process.env.REDIS_URL;
const originalNodeEnv = process.env.NODE_ENV;

process.env.AI_REWRITE_QUEUE_DRIVER = "memory";
delete process.env.REDIS_URL;
delete process.env.NODE_ENV;

resetTaskQueueForTests();
const payload = createTaskJobPayload({
  taskId: "task-queue-test",
  sessionId: "session-queue-test",
  mode: "workbench",
});
const result = await enqueueTaskJob(payload);

assert.equal(result.driver, "memory");
assert.equal(result.queueName, "document-processing");
assert.match(result.jobId, /^memory-/);
assert.deepEqual(await drainMemoryTaskJobs(), [payload]);
assert.deepEqual(await drainMemoryTaskJobs(), []);

const bullmqConfig = getQueueRuntimeConfig({
  NODE_ENV: "development",
  REDIS_URL: "redis://127.0.0.1:6379/0",
});
assert.equal(bullmqConfig.driver, "bullmq");
assert.equal(bullmqConfig.redisUrl, "redis://127.0.0.1:6379/0");
assert.equal(bullmqConfig.queueName, "document-processing");
assert.equal(bullmqConfig.concurrency, 1);

const explicitBullmqConfig = getQueueRuntimeConfig({
  NODE_ENV: "development",
  AI_REWRITE_QUEUE_DRIVER: "bullmq",
  REDIS_URL: "redis://127.0.0.1:6379/1",
  AI_REWRITE_TASK_QUEUE_CONCURRENCY: "3",
  AI_REWRITE_QUEUE_NAME: "custom-document-processing",
});
assert.equal(explicitBullmqConfig.driver, "bullmq");
assert.equal(explicitBullmqConfig.redisUrl, "redis://127.0.0.1:6379/1");
assert.equal(explicitBullmqConfig.queueName, "custom-document-processing");
assert.equal(explicitBullmqConfig.concurrency, 3);

assert.throws(
  () =>
    getQueueRuntimeConfig({
      NODE_ENV: "development",
      AI_REWRITE_QUEUE_DRIVER: "bullmq",
    }),
  /REDIS_URL is required/u,
);

assert.throws(
  () =>
    getQueueRuntimeConfig({
      NODE_ENV: "production",
    }),
  /REDIS_URL is required/u,
);

if (originalQueueDriver === undefined) {
  delete process.env.AI_REWRITE_QUEUE_DRIVER;
} else {
  process.env.AI_REWRITE_QUEUE_DRIVER = originalQueueDriver;
}
if (originalRedisUrl === undefined) {
  delete process.env.REDIS_URL;
} else {
  process.env.REDIS_URL = originalRedisUrl;
}
if (originalNodeEnv === undefined) {
  delete process.env.NODE_ENV;
} else {
  process.env.NODE_ENV = originalNodeEnv;
}

console.log("queue tests passed");