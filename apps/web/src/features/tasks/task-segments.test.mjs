import assert from "node:assert/strict";

import {
  getDocumentSegmentRepository,
  getTaskRepository,
  resetDocumentSegmentRepositoryForTests,
  resetTaskRepositoryForTests,
} from "@ai-rewrite/db";

import { GET as getTaskSegment } from "../../app/api/tasks/[taskId]/segments/route.ts";
import {
  buildTaskSegmentQueryKey,
  buildTaskSegmentRequestPath,
  normalizeTaskSegmentQuery,
} from "./task-segments-query.ts";
import { readAuthorizedTaskSegment } from "./task-segments-service.ts";
import {
  createTaskAccessContext,
  getTaskAccessTokenHash,
  parseStoredTaskContext,
  serializeTaskContext,
  TASK_CONTEXT_COOKIE,
} from "../../task-session.ts";

function createTaskContextCookie({ taskId, sessionId, accessToken }) {
  return parseStoredTaskContext(
    serializeTaskContext(
      createTaskAccessContext({
        sessionId,
        taskId,
        mode: "workbench",
        accessToken,
      }),
    ),
  );
}

async function createTaskRecord({
  taskId,
  sessionId,
  accessToken,
  status,
  stage,
  progressPercent,
  statusMessage,
  nextStep,
}) {
  return getTaskRepository().createTaskRecord({
    taskId,
    sessionId,
    mode: "workbench",
    status,
    stage,
    progressPercent,
    statusMessage,
    nextStep,
    retryable: false,
    accessTokenHash: getTaskAccessTokenHash(accessToken),
    originalFileName: `${taskId}.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: 1024,
    checksumSha256: `${taskId}-checksum`,
    bucketName: "memory-private-originals",
    objectKey: `${taskId}/original.docx`,
    storageProvider: "memory",
  });
}

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test";

resetTaskRepositoryForTests();
resetDocumentSegmentRepositoryForTests();
await createTaskRecord({
  taskId: "task-segment-pending",
  sessionId: "session-segment-pending",
  accessToken: "segment-pending-token",
  status: "processing",
  stage: "scan",
  progressPercent: 78,
  statusMessage: "正在扫描高风险段落与表达问题。",
  nextStep: "请保持页面打开，等待扫描完成。",
});
const pendingContext = createTaskContextCookie({
  taskId: "task-segment-pending",
  sessionId: "session-segment-pending",
  accessToken: "segment-pending-token",
});
const pendingResult = await readAuthorizedTaskSegment({
  taskId: "task-segment-pending",
  paragraphId: "p-003",
  storedContext: pendingContext,
});
assert.equal("data" in pendingResult, true);
assert.equal(pendingResult.data.state, "pending");
assert.equal(pendingResult.data.item, null);
assert.match(pendingResult.data.message, /生成当前段落的诊断面板数据/u);

resetTaskRepositoryForTests();
resetDocumentSegmentRepositoryForTests();
await createTaskRecord({
  taskId: "task-segment-ready",
  sessionId: "session-segment-ready",
  accessToken: "segment-ready-token",
  status: "completed",
  stage: "scan",
  progressPercent: 100,
  statusMessage: "上传、解析和扫描阶段已完成。",
  nextStep: "你现在可以查看诊断面板。",
});
await getDocumentSegmentRepository().replaceTaskDocumentSegments({
  taskId: "task-segment-ready",
  items: [
    {
      segmentId: "segment-1",
      paragraphId: "p-003",
      originalText: "近年来，随着相关研究的不断深入，国内外学者围绕该问题展开了广泛讨论。",
      previousContext: "上一段先交代了研究背景。",
      nextContext: "下一段将说明本文研究切口。",
      diagnosisReason: "这一段使用了高频背景套话，缺少与本文主题绑定的细节。",
      confidenceBucket: "high_confidence_issue",
      confidenceLabel: "高置信问题",
      confidenceSummary: "建议优先处理。",
      contextStatus: "full",
      contextStatusLabel: "上下文完整",
    },
  ],
});
const readyContext = createTaskContextCookie({
  taskId: "task-segment-ready",
  sessionId: "session-segment-ready",
  accessToken: "segment-ready-token",
});
const readyResult = await readAuthorizedTaskSegment({
  taskId: "task-segment-ready",
  paragraphId: "p-003",
  storedContext: readyContext,
});
assert.equal("data" in readyResult, true);
assert.equal(readyResult.data.state, "ready");
assert.equal(readyResult.data.item?.paragraphId, "p-003");
assert.equal(readyResult.data.item?.confidenceBucket, "high_confidence_issue");
assert.equal(readyResult.data.item?.confidenceLabel, "高置信问题");
assert.equal(readyResult.data.item?.contextStatus, "full");
assert.match(readyResult.data.item?.diagnosisReason ?? "", /背景套话/u);

const unavailableResult = await readAuthorizedTaskSegment({
  taskId: "task-segment-ready",
  paragraphId: "p-404",
  storedContext: readyContext,
});
assert.equal("data" in unavailableResult, true);
assert.equal(unavailableResult.data.state, "unavailable");
assert.equal(unavailableResult.data.item, null);
assert.match(unavailableResult.data.message, /暂未就绪/u);

const authorizedResponse = await getTaskSegment(
  new Request("http://localhost/api/tasks/task-segment-ready/segments?paragraphId=p-003", {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: "task-segment-ready" }),
  },
);
assert.equal(authorizedResponse.status, 200);
const authorizedPayload = await authorizedResponse.json();
assert.equal(authorizedPayload.data.state, "ready");
assert.equal(authorizedPayload.data.item.paragraphId, "p-003");

const invalidQueryResponse = await getTaskSegment(
  new Request("http://localhost/api/tasks/task-segment-ready/segments", {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: "task-segment-ready" }),
  },
);
assert.equal(invalidQueryResponse.status, 400);
const invalidQueryPayload = await invalidQueryResponse.json();
assert.equal(invalidQueryPayload.error.code, "invalid_task_segment_query");

const unauthorizedResponse = await getTaskSegment(
  new Request("http://localhost/api/tasks/task-segment-ready/segments?paragraphId=p-003", {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(
        createTaskAccessContext({
          taskId: "task-segment-ready",
          sessionId: "session-segment-ready",
          mode: "workbench",
          accessToken: "tampered-token",
        }),
      )}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: "task-segment-ready" }),
  },
);
assert.equal(unauthorizedResponse.status, 401);
const unauthorizedPayload = await unauthorizedResponse.json();
assert.equal(unauthorizedPayload.error.code, "unauthorized_task_access");

assert.deepEqual(normalizeTaskSegmentQuery("p-003"), {
  paragraphId: "p-003",
});
assert.deepEqual(buildTaskSegmentQueryKey("task-segment-ready", "p-003"), [
  "task-segment",
  "task-segment-ready",
  "p-003",
]);
assert.equal(
  buildTaskSegmentRequestPath("task-segment-ready", "p-003"),
  "/api/tasks/task-segment-ready/segments?paragraphId=p-003",
);

if (originalNodeEnv === undefined) {
  delete process.env.NODE_ENV;
} else {
  process.env.NODE_ENV = originalNodeEnv;
}

console.log("task segments tests passed");
