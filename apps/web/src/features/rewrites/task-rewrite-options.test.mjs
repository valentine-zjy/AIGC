import assert from "node:assert/strict";

import {
  getRewriteOptionRepository,
  getTaskRepository,
  resetRewriteOptionRepositoryForTests,
  resetTaskRepositoryForTests,
} from "@ai-rewrite/db";

import { GET as getTaskRewriteOptions } from "../../app/api/tasks/[taskId]/rewrite-options/route.ts";
import {
  buildTaskRewriteOptionsQueryKey,
  buildTaskRewriteOptionsRequestPath,
  normalizeTaskRewriteOptionQuery,
} from "./task-rewrite-options-query.ts";
import { readAuthorizedTaskRewriteOptions } from "./task-rewrite-options-service.ts";
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
  mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    mimeType,
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
resetRewriteOptionRepositoryForTests();
await createTaskRecord({
  taskId: "task-rewrite-pending",
  sessionId: "session-rewrite-pending",
  accessToken: "rewrite-pending-token",
  status: "processing",
  stage: "scan",
  progressPercent: 78,
  statusMessage: "正在扫描高风险段落与表达问题。",
  nextStep: "请保持页面打开，等待扫描完成。",
});
const pendingContext = createTaskContextCookie({
  taskId: "task-rewrite-pending",
  sessionId: "session-rewrite-pending",
  accessToken: "rewrite-pending-token",
});
const pendingResult = await readAuthorizedTaskRewriteOptions({
  taskId: "task-rewrite-pending",
  paragraphId: "p-003",
  storedContext: pendingContext,
});
assert.equal("data" in pendingResult, true);
assert.equal(pendingResult.data.state, "pending");
assert.equal(pendingResult.data.options.length, 0);
assert.match(pendingResult.data.message, /局部改写建议/u);

resetTaskRepositoryForTests();
resetRewriteOptionRepositoryForTests();
await createTaskRecord({
  taskId: "task-rewrite-ready",
  sessionId: "session-rewrite-ready",
  accessToken: "rewrite-ready-token",
  status: "completed",
  stage: "scan",
  progressPercent: 100,
  statusMessage: "上传、解析和扫描阶段已完成。",
  nextStep: "你现在可以查看建议比较器。",
});
await getRewriteOptionRepository().replaceTaskRewriteOptions({
  taskId: "task-rewrite-ready",
  items: [
    {
      optionId: "rewrite-1",
      paragraphId: "p-003",
      optionRank: 1,
      title: "补足研究空缺与本文切口",
      strategyLabel: "强化问题绑定",
      candidateText: "现有研究虽然已围绕这一议题积累了不少讨论，但对于其中具体作用机制的解释仍较为粗略。",
      rationale: "用研究空缺替代空泛综述语气。",
      diffSummary: "补入具体机制不足的判断。",
      isRecommended: true,
    },
    {
      optionId: "rewrite-2",
      paragraphId: "p-003",
      optionRank: 2,
      title: "保留背景，但加入对象限定",
      strategyLabel: "增加具体约束",
      candidateText: "围绕这一议题的既有研究已经形成一定积累，但多数讨论仍停留在宏观层面。",
      rationale: "把背景综述拉回本文对象。",
      diffSummary: "增加研究对象限定。",
      isRecommended: false,
    },
  ],
});
const readyContext = createTaskContextCookie({
  taskId: "task-rewrite-ready",
  sessionId: "session-rewrite-ready",
  accessToken: "rewrite-ready-token",
});
const readyResult = await readAuthorizedTaskRewriteOptions({
  taskId: "task-rewrite-ready",
  paragraphId: "p-003",
  storedContext: readyContext,
});
assert.equal("data" in readyResult, true);
assert.equal(readyResult.data.state, "ready");
assert.equal(readyResult.data.options.length, 2);
assert.equal(readyResult.data.options[0]?.optionRank, 1);
assert.equal(readyResult.data.options[0]?.isRecommended, true);
assert.equal(readyResult.data.options[0]?.strategyLabel, "强化问题绑定");

const unavailableResult = await readAuthorizedTaskRewriteOptions({
  taskId: "task-rewrite-ready",
  paragraphId: "p-404",
  storedContext: readyContext,
});
assert.equal("data" in unavailableResult, true);
assert.equal(unavailableResult.data.state, "unavailable");
assert.equal(unavailableResult.data.options.length, 0);
assert.match(unavailableResult.data.message, /暂未就绪/u);

const authorizedResponse = await getTaskRewriteOptions(
  new Request(
    "http://localhost/api/tasks/task-rewrite-ready/rewrite-options?paragraphId=p-003",
    {
      method: "GET",
      headers: {
        cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}`,
      },
    },
  ),
  {
    params: Promise.resolve({ taskId: "task-rewrite-ready" }),
  },
);
assert.equal(authorizedResponse.status, 200);
const authorizedPayload = await authorizedResponse.json();
assert.equal(authorizedPayload.data.state, "ready");
assert.equal(authorizedPayload.data.options.length, 2);

const invalidQueryResponse = await getTaskRewriteOptions(
  new Request("http://localhost/api/tasks/task-rewrite-ready/rewrite-options", {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: "task-rewrite-ready" }),
  },
);
assert.equal(invalidQueryResponse.status, 400);
const invalidQueryPayload = await invalidQueryResponse.json();
assert.equal(invalidQueryPayload.error.code, "invalid_task_rewrite_query");

const unauthorizedResponse = await getTaskRewriteOptions(
  new Request(
    "http://localhost/api/tasks/task-rewrite-ready/rewrite-options?paragraphId=p-003",
    {
      method: "GET",
      headers: {
        cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(
          createTaskAccessContext({
            taskId: "task-rewrite-ready",
            sessionId: "session-rewrite-ready",
            mode: "workbench",
            accessToken: "tampered-token",
          }),
        )}`,
      },
    },
  ),
  {
    params: Promise.resolve({ taskId: "task-rewrite-ready" }),
  },
);
assert.equal(unauthorizedResponse.status, 401);
const unauthorizedPayload = await unauthorizedResponse.json();
assert.equal(unauthorizedPayload.error.code, "unauthorized_task_access");

resetTaskRepositoryForTests();
resetRewriteOptionRepositoryForTests();
await createTaskRecord({
  taskId: "task-rewrite-pdf",
  sessionId: "session-rewrite-pdf",
  accessToken: "rewrite-pdf-token",
  status: "completed",
  stage: "scan",
  progressPercent: 100,
  statusMessage: "PDF 扫描完成。",
  nextStep: "当前仅支持结果查看。",
  mimeType: "application/pdf",
});
const pdfContext = createTaskContextCookie({
  taskId: "task-rewrite-pdf",
  sessionId: "session-rewrite-pdf",
  accessToken: "rewrite-pdf-token",
});
const pdfResult = await readAuthorizedTaskRewriteOptions({
  taskId: "task-rewrite-pdf",
  paragraphId: "p-003",
  storedContext: pdfContext,
});
assert.equal("data" in pdfResult, true);
assert.equal(pdfResult.data.state, "unavailable");
assert.match(pdfResult.data.message, /Word \/ TXT/u);

assert.deepEqual(normalizeTaskRewriteOptionQuery("p-003"), {
  paragraphId: "p-003",
});
assert.deepEqual(
  buildTaskRewriteOptionsQueryKey("task-rewrite-ready", "p-003"),
  ["task-rewrite-options", "task-rewrite-ready", "p-003"],
);
assert.equal(
  buildTaskRewriteOptionsRequestPath("task-rewrite-ready", "p-003"),
  "/api/tasks/task-rewrite-ready/rewrite-options?paragraphId=p-003",
);

if (originalNodeEnv === undefined) {
  delete process.env.NODE_ENV;
} else {
  process.env.NODE_ENV = originalNodeEnv;
}

console.log("task rewrite options tests passed");