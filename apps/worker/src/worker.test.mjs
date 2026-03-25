import assert from "node:assert/strict";

import {
  getDocumentSegmentRepository,
  getRewriteOptionRepository,
  getRiskFindingRepository,
  getTaskRepository,
  resetDocumentSegmentRepositoryForTests,
  resetRewriteOptionRepositoryForTests,
  resetRiskFindingRepositoryForTests,
  resetTaskRepositoryForTests,
} from "@ai-rewrite/db";
import {
  createTaskJobPayload,
  enqueueTaskJob,
  resetTaskQueueForTests,
} from "@ai-rewrite/queue";

import { processTaskJob } from "./jobs/ingest-document.job.ts";
import { runMemoryTaskQueueOnce } from "./queues/task-queue.ts";
import { cleanupExpiredTasksEntry } from "./retention/cleanup-expired-tasks.ts";

function createQueuedTask(taskId, createdAt = new Date()) {
  return getTaskRepository().createTaskRecord({
    taskId,
    sessionId: `session-${taskId}`,
    mode: "workbench",
    status: "queued",
    stage: "upload",
    progressPercent: 12,
    statusMessage: "任务已受理，正在等待队列接手。",
    nextStep: "保持当前页面打开，系统会继续刷新任务阶段。",
    retryable: false,
    accessTokenHash: `hash-${taskId}`,
    originalFileName: `${taskId}.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: 1024,
    checksumSha256: `checksum-${taskId}`,
    bucketName: "memory-private-originals",
    objectKey: `${taskId}/original.docx`,
    storageProvider: "memory",
    createdAt,
  });
}

const originalQueueDriver = process.env.AI_REWRITE_QUEUE_DRIVER;
const originalRedisUrl = process.env.REDIS_URL;
const originalRetentionDays = process.env.AI_REWRITE_RETENTION_DAYS;
process.env.AI_REWRITE_QUEUE_DRIVER = "memory";
process.env.AI_REWRITE_RETENTION_DAYS = "7";
delete process.env.REDIS_URL;

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
resetDocumentSegmentRepositoryForTests();
resetRewriteOptionRepositoryForTests();
resetTaskQueueForTests();
await createQueuedTask("task-worker-success");
await enqueueTaskJob(
  createTaskJobPayload({
    taskId: "task-worker-success",
    sessionId: "session-task-worker-success",
    mode: "workbench",
  }),
);
assert.equal(await runMemoryTaskQueueOnce({ stageDelayMs: 0 }), 1);
const completedTask = await getTaskRepository().findTaskRecordById(
  "task-worker-success",
);
assert.equal(completedTask?.status, "completed");
assert.equal(completedTask?.stage, "scan");
assert.equal(completedTask?.progressPercent, 100);
assert.equal(completedTask?.failureCode, null);
assert.match(
  completedTask?.statusMessage ?? "",
  /候选改写建议已经可读/u,
);
const generatedRiskFindings = await getRiskFindingRepository().listTaskRiskFindings({
  taskId: "task-worker-success",
});
assert.equal(generatedRiskFindings.length, 4);
assert.equal(generatedRiskFindings[0]?.score, 97);
assert.equal(generatedRiskFindings[0]?.handlingStatus, "pending");
assert.equal(generatedRiskFindings[0]?.paragraphId, "p-003");
assert.equal(generatedRiskFindings[0]?.issueType, "background_template");
assert.equal(generatedRiskFindings[0]?.issueTypeLabel, "背景套话");
assert.match(generatedRiskFindings[0]?.excerpt ?? "", /近年来/u);
assert.ok(generatedRiskFindings[0].score > generatedRiskFindings[1].score);
const generatedSegment = await getDocumentSegmentRepository().findTaskDocumentSegment({
  taskId: "task-worker-success",
  paragraphId: "p-003",
});
assert.equal(generatedSegment?.paragraphId, "p-003");
assert.equal(generatedSegment?.confidenceBucket, "high_confidence_issue");
assert.equal(generatedSegment?.confidenceLabel, "高置信问题");
assert.equal(generatedSegment?.contextStatus, "full");
assert.match(generatedSegment?.diagnosisReason ?? "", /模板化/u);
const generatedRewriteOptions = await getRewriteOptionRepository().listTaskRewriteOptions({
  taskId: "task-worker-success",
  paragraphId: "p-003",
});
assert.equal(generatedRewriteOptions.length, 3);
assert.equal(generatedRewriteOptions[0]?.optionRank, 1);
assert.equal(generatedRewriteOptions[0]?.isRecommended, true);
assert.equal(generatedRewriteOptions[0]?.strategyLabel, "强化问题绑定");
assert.match(generatedRewriteOptions[0]?.candidateText ?? "", /切入点/u);

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
resetDocumentSegmentRepositoryForTests();
resetRewriteOptionRepositoryForTests();
resetTaskQueueForTests();
await createQueuedTask("task-worker-failure");
await processTaskJob(
  createTaskJobPayload({
    taskId: "task-worker-failure",
    sessionId: "session-task-worker-failure",
    mode: "workbench",
  }),
  {
    stageDelayMs: 0,
    failAtStage: "scan",
  },
);
const failedTask = await getTaskRepository().findTaskRecordById(
  "task-worker-failure",
);
assert.equal(failedTask?.status, "failed");
assert.equal(failedTask?.stage, "scan");
assert.equal(failedTask?.failureCode, "scan_failed");
assert.equal(failedTask?.retryable, true);
assert.match(failedTask?.nextStep ?? "", /默认保留期保存/u);
assert.deepEqual(
  await getRiskFindingRepository().listTaskRiskFindings({
    taskId: "task-worker-failure",
  }),
  [],
);
assert.equal(
  await getDocumentSegmentRepository().findTaskDocumentSegment({
    taskId: "task-worker-failure",
    paragraphId: "p-003",
  }),
  null,
);
assert.deepEqual(
  await getRewriteOptionRepository().listTaskRewriteOptions({
    taskId: "task-worker-failure",
    paragraphId: "p-003",
  }),
  [],
);

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
resetDocumentSegmentRepositoryForTests();
resetRewriteOptionRepositoryForTests();
resetTaskQueueForTests();
await createQueuedTask(
  "task-worker-expired",
  new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
);
await createQueuedTask("task-worker-fresh");
const cleanupResult = await cleanupExpiredTasksEntry();
assert.equal(cleanupResult.scannedCount, 1);
assert.deepEqual(cleanupResult.deletedTaskIds, ["task-worker-expired"]);
assert.deepEqual(cleanupResult.failedTaskIds, []);
assert.equal(
  await getTaskRepository().findTaskRecordById("task-worker-expired"),
  null,
);
assert.notEqual(
  await getTaskRepository().findTaskRecordById("task-worker-fresh"),
  null,
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
if (originalRetentionDays === undefined) {
  delete process.env.AI_REWRITE_RETENTION_DAYS;
} else {
  process.env.AI_REWRITE_RETENTION_DAYS = originalRetentionDays;
}

console.log("worker tests passed");