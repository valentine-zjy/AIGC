import assert from "node:assert/strict";

import { getTaskRepository, resetTaskRepositoryForTests } from "@ai-rewrite/db";
import {
  drainMemoryTaskJobs,
  resetTaskQueueForTests,
} from "@ai-rewrite/queue";
import { resetOriginalDocumentStorageForTests } from "@ai-rewrite/storage";

import { DELETE as deleteTask, GET as getTask } from "./api/tasks/[taskId]/route.ts";
import { POST as createTaskContext } from "./api/task-contexts/route.ts";
import { POST as acceptUpload } from "./api/uploads/route.ts";
import { getUploadEntryState } from "../features/upload/upload-entry-state.ts";
import {
  acceptUploadSubmission,
  resetUploadRateLimitStore,
} from "../features/upload/upload-service.ts";
import { submitUploadRequest } from "../features/upload/upload-request.ts";
import { inspectUploadFile } from "../features/upload/upload-schema.ts";
import { buildTaskStatusViewModel } from "../features/tasks/task-status-copy.ts";
import { readAuthorizedTask } from "../features/tasks/task-service.ts";
import {
  createAnonymousTaskContext,
  createTaskAccessContext,
  getTaskAccessTokenHash,
  parseRequestedMode,
  parseStoredTaskContext,
  serializeTaskContext,
  TASK_CONTEXT_COOKIE,
} from "../task-session.ts";

function getCookieValueFromSetCookie(rawSetCookie) {
  return rawSetCookie?.split(";")[0]?.split("=")?.slice(1).join("=");
}

const originalQueueDriver = process.env.AI_REWRITE_QUEUE_DRIVER;
const originalRedisUrl = process.env.REDIS_URL;
const originalRetentionDays = process.env.AI_REWRITE_RETENTION_DAYS;
process.env.AI_REWRITE_QUEUE_DRIVER = "memory";
process.env.AI_REWRITE_RETENTION_DAYS = "7";
delete process.env.REDIS_URL;

assert.equal(parseRequestedMode("workbench"), "workbench");
assert.equal(parseRequestedMode("one-click"), "one-click");
assert.equal(parseRequestedMode("invalid"), null);
assert.equal(parseRequestedMode(undefined), null);

const rawBootstrapContext = serializeTaskContext({
  kind: "bootstrap",
  sessionId: "session-123",
  bootstrapToken: "token-123",
  csrfToken: "csrf-123",
  mode: "workbench",
  issuedAt: "2026-03-23T05:00:00.000Z",
});

assert.deepEqual(parseStoredTaskContext(rawBootstrapContext), {
  kind: "bootstrap",
  sessionId: "session-123",
  bootstrapToken: "token-123",
  csrfToken: "csrf-123",
  mode: "workbench",
  issuedAt: "2026-03-23T05:00:00.000Z",
});
assert.equal(rawBootstrapContext.includes("{"), false);
assert.equal(rawBootstrapContext.includes("session-123"), false);
assert.equal(parseStoredTaskContext(`${rawBootstrapContext.slice(0, -1)}x`), null);
assert.equal(parseStoredTaskContext("not-json"), null);
assert.equal(
  parseStoredTaskContext(JSON.stringify({ mode: "wrong" })),
  null,
);

const rawTaskContext = serializeTaskContext({
  kind: "task",
  sessionId: "session-123",
  taskId: "task-123",
  accessToken: "access-123",
  mode: "workbench",
  issuedAt: "2026-03-23T05:00:00.000Z",
});

assert.deepEqual(parseStoredTaskContext(rawTaskContext), {
  kind: "task",
  sessionId: "session-123",
  taskId: "task-123",
  accessToken: "access-123",
  csrfToken: "access-123",
  mode: "workbench",
  issuedAt: "2026-03-23T05:00:00.000Z",
});

const originalNodeEnv = process.env.NODE_ENV;
const originalTaskContextSecret = process.env.TASK_CONTEXT_SECRET;
process.env.NODE_ENV = "production";
delete process.env.TASK_CONTEXT_SECRET;
assert.equal(parseStoredTaskContext(rawBootstrapContext), null);
const unavailableModeFormData = new FormData();
unavailableModeFormData.set("mode", "workbench");
const unavailableTaskContextResponse = await createTaskContext(
  new Request("http://localhost/api/task-contexts", {
    method: "POST",
    body: unavailableModeFormData,
  }),
);
assert.equal(unavailableTaskContextResponse.status, 503);
const unavailableTaskContextPayload = await unavailableTaskContextResponse.json();
assert.equal(unavailableTaskContextPayload.error, "task_context_unavailable");
if (originalNodeEnv === undefined) {
  delete process.env.NODE_ENV;
} else {
  process.env.NODE_ENV = originalNodeEnv;
}
if (originalTaskContextSecret === undefined) {
  delete process.env.TASK_CONTEXT_SECRET;
} else {
  process.env.TASK_CONTEXT_SECRET = originalTaskContextSecret;
}

assert.deepEqual(
  getUploadEntryState({
    requestedMode: "workbench",
    storedContext: null,
  }),
  {
    activeMode: null,
    hasTrustedContext: false,
    requestedMode: "workbench",
  },
);
assert.deepEqual(
  getUploadEntryState({
    requestedMode: "workbench",
    storedContext: createAnonymousTaskContext("workbench"),
  }),
  {
    activeMode: "workbench",
    hasTrustedContext: true,
    requestedMode: "workbench",
  },
);

const validDocx = new File(["hello"], "paper.docx", {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});
const validPdf = new File(["%PDF"], "paper.pdf", {
  type: "application/pdf",
});
const invalidMime = new File(["hello"], "paper.docx", {
  type: "text/plain",
});
const invalidExtension = new File(["hello"], "paper.exe", {
  type: "application/octet-stream",
});
const oversizedFile = new File([
  new Uint8Array(20 * 1024 * 1024 + 1),
], "paper.txt", {
  type: "text/plain",
});

assert.equal(inspectUploadFile(validDocx, { allowEmptyMime: false }).ok, true);
assert.equal(inspectUploadFile(validPdf, { allowEmptyMime: false }).ok, true);
assert.equal(
  inspectUploadFile(invalidMime, { allowEmptyMime: false }).issues[0]?.code,
  "mime_mismatch",
);
assert.equal(
  inspectUploadFile(invalidExtension, { allowEmptyMime: false }).issues[0]?.code,
  "unsupported_extension",
);
assert.equal(
  inspectUploadFile(oversizedFile, { allowEmptyMime: false }).issues[0]?.code,
  "file_too_large",
);

resetUploadRateLimitStore();
resetTaskRepositoryForTests();
resetOriginalDocumentStorageForTests();
resetTaskQueueForTests();
const anonymousContext = createAnonymousTaskContext("workbench");
const acceptedUpload = await acceptUploadSubmission({
  anonymousContext,
  file: validDocx,
  clientIp: "127.0.0.1",
});

assert.equal("data" in acceptedUpload, true);
assert.equal(acceptedUpload.data.status, "queued");
assert.equal(acceptedUpload.data.stage, "upload");
assert.equal(acceptedUpload.data.progressPercent, 12);
assert.match(acceptedUpload.data.taskId, /^task_/);
assert.match(acceptedUpload.data.nextPath, /^\/tasks\/task_/);
assert.equal(acceptedUpload.taskContext.kind, "task");
assert.equal(acceptedUpload.taskContext.taskId, acceptedUpload.data.taskId);
assert.equal((await drainMemoryTaskJobs()).length, 1);

const authorizedRead = await readAuthorizedTask({
  taskId: acceptedUpload.data.taskId,
  storedContext: acceptedUpload.taskContext,
});
assert.equal("data" in authorizedRead, true);
assert.equal(authorizedRead.data.stage, "upload");
assert.equal(authorizedRead.data.status, "queued");
assert.equal(authorizedRead.data.poll.shouldPoll, true);
assert.equal(authorizedRead.data.fileName, "paper.docx");
assert.equal(
  buildTaskStatusViewModel(authorizedRead.data).stages[0]?.state,
  "current",
);

const queueFailureUpload = await acceptUploadSubmission({
  anonymousContext: createAnonymousTaskContext("workbench"),
  file: validDocx,
  clientIp: "127.0.0.1",
  enqueueTask: async () => {
    throw new Error("queue down");
  },
});
assert.equal("data" in queueFailureUpload, true);
assert.equal(queueFailureUpload.data.status, "failed");
assert.equal(queueFailureUpload.data.stage, "upload");
const queueFailureRead = await readAuthorizedTask({
  taskId: queueFailureUpload.data.taskId,
  storedContext: queueFailureUpload.taskContext,
});
assert.equal("data" in queueFailureRead, true);
assert.equal(queueFailureRead.data.failure?.code, "queue_unavailable");
assert.equal(queueFailureRead.data.retryable, true);
assert.equal(
  buildTaskStatusViewModel(queueFailureRead.data).stages[0]?.state,
  "failed",
);

const storageFailure = await acceptUploadSubmission({
  anonymousContext: createAnonymousTaskContext("workbench"),
  file: validDocx,
  clientIp: "127.0.0.1",
  storage: {
    async storeOriginalDocument() {
      throw new Error("storage down");
    },
    async deleteOriginalDocument() {},
  },
});
assert.equal("error" in storageFailure, true);
assert.equal(storageFailure.error, "upload_unavailable");

let cleanedObjectKey = null;
const repositoryFailure = await acceptUploadSubmission({
  anonymousContext: createAnonymousTaskContext("workbench"),
  file: validDocx,
  clientIp: "127.0.0.1",
  storage: {
    async storeOriginalDocument() {
      return {
        storageProvider: "memory",
        bucketName: "memory-private-originals",
        objectKey: "session/task/original/file.docx",
        checksumSha256: "abc123",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        byteSize: validDocx.size,
      };
    },
    async deleteOriginalDocument(objectKey) {
      cleanedObjectKey = objectKey;
    },
  },
  repository: {
    async createTaskRecord() {
      throw new Error("db down");
    },
    async findTaskRecordById() {
      return null;
    },
    async updateTaskRecordState() {
      return null;
    },
  },
});
assert.equal("error" in repositoryFailure, true);
assert.equal(repositoryFailure.error, "upload_unavailable");
assert.equal(cleanedObjectKey, "session/task/original/file.docx");

const modeFormData = new FormData();
modeFormData.set("mode", "workbench");
const taskContextResponse = await createTaskContext(
  new Request("http://localhost/api/task-contexts", {
    method: "POST",
    body: modeFormData,
  }),
);

assert.equal(taskContextResponse.status, 303);
assert.equal(taskContextResponse.headers.get("location"), "http://localhost/upload");
const bootstrapSetCookieHeader = taskContextResponse.headers.get("set-cookie");
assert.ok(bootstrapSetCookieHeader);
assert.match(bootstrapSetCookieHeader, new RegExp(`${TASK_CONTEXT_COOKIE}=`));
const bootstrapCookieValue = getCookieValueFromSetCookie(bootstrapSetCookieHeader);
const parsedBootstrapCookie = parseStoredTaskContext(bootstrapCookieValue);
assert.equal(parsedBootstrapCookie?.kind, "bootstrap");
assert.equal(parsedBootstrapCookie?.mode, "workbench");

resetUploadRateLimitStore();
resetTaskRepositoryForTests();
resetOriginalDocumentStorageForTests();
resetTaskQueueForTests();
const uploadFormData = new FormData();
uploadFormData.set("document", validDocx);
uploadFormData.set("_csrf", parsedBootstrapCookie.csrfToken);
const uploadResponse = await acceptUpload(
  new Request("http://localhost/api/uploads", {
    method: "POST",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${bootstrapCookieValue}`,
      origin: "http://localhost",
      "x-forwarded-for": "127.0.0.1",
    },
    body: uploadFormData,
  }),
);

assert.equal(uploadResponse.status, 202);
const uploadPayload = await uploadResponse.json();
assert.equal(uploadPayload.data.status, "queued");
assert.equal(uploadPayload.data.stage, "upload");
assert.equal(uploadPayload.data.progressPercent, 12);
assert.equal(uploadPayload.data.mode, "workbench");
assert.match(uploadPayload.data.nextPath, /^\/tasks\/task_/);
const taskSetCookieHeader = uploadResponse.headers.get("set-cookie");
assert.ok(taskSetCookieHeader);
const taskCookieValue = getCookieValueFromSetCookie(taskSetCookieHeader);
const parsedTaskCookie = parseStoredTaskContext(taskCookieValue);
assert.equal(parsedTaskCookie?.kind, "task");
assert.equal(parsedTaskCookie?.taskId, uploadPayload.data.taskId);
assert.match(parsedTaskCookie?.csrfToken ?? "", /\S+/);
assert.equal((await drainMemoryTaskJobs()).length, 1);

const taskResponse = await getTask(
  new Request(`http://localhost/api/tasks/${uploadPayload.data.taskId}`, {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${taskCookieValue}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: uploadPayload.data.taskId }),
  },
);
assert.equal(taskResponse.status, 200);
const taskPayload = await taskResponse.json();
assert.equal(taskPayload.data.taskId, uploadPayload.data.taskId);
assert.equal(taskPayload.data.stage, "upload");
assert.equal(taskPayload.data.poll.shouldPoll, true);
assert.equal(taskPayload.data.failure, null);

await getTaskRepository().updateTaskRecordState({
  taskId: uploadPayload.data.taskId,
  status: "completed",
  stage: "export",
  progressPercent: 100,
  statusMessage: "任务状态轨道已完成。",
  nextStep: "可以返回上传页继续处理新文档。",
  retryable: false,
});
const completedRead = await readAuthorizedTask({
  taskId: uploadPayload.data.taskId,
  storedContext: parsedTaskCookie,
});
assert.equal("data" in completedRead, true);
assert.equal(completedRead.data.poll.shouldPoll, false);
assert.equal(buildTaskStatusViewModel(completedRead.data).statusLabel, "已完成");

const invalidCsrfFormData = new FormData();
invalidCsrfFormData.set("document", validDocx);
invalidCsrfFormData.set("_csrf", "wrong-token");
const invalidCsrfResponse = await acceptUpload(
  new Request("http://localhost/api/uploads", {
    method: "POST",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${bootstrapCookieValue}`,
      origin: "http://localhost",
      "x-forwarded-for": "127.0.0.1",
    },
    body: invalidCsrfFormData,
  }),
);
assert.equal(invalidCsrfResponse.status, 403);
const invalidCsrfPayload = await invalidCsrfResponse.json();
assert.equal(invalidCsrfPayload.error.code, "csrf_invalid");

const missingContextFormData = new FormData();
missingContextFormData.set("document", validDocx);
missingContextFormData.set("_csrf", "anything");
const missingContextResponse = await acceptUpload(
  new Request("http://localhost/api/uploads", {
    method: "POST",
    headers: {
      origin: "http://localhost",
    },
    body: missingContextFormData,
  }),
);
assert.equal(missingContextResponse.status, 401);
const missingContextPayload = await missingContextResponse.json();
assert.equal(missingContextPayload.error.code, "missing_context");

const tamperedTaskCookie = serializeTaskContext(
  createTaskAccessContext({
    sessionId: parsedTaskCookie.sessionId,
    taskId: parsedTaskCookie.taskId,
    mode: parsedTaskCookie.mode,
    accessToken: "tampered-token",
  }),
);
const unauthorizedTaskResponse = await getTask(
  new Request(`http://localhost/api/tasks/${uploadPayload.data.taskId}`, {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${tamperedTaskCookie}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: uploadPayload.data.taskId }),
  },
);
assert.equal(unauthorizedTaskResponse.status, 401);
const unauthorizedTaskPayload = await unauthorizedTaskResponse.json();
assert.equal(unauthorizedTaskPayload.error.code, "unauthorized_task_access");

const invalidDeleteResponse = await deleteTask(
  new Request(`http://localhost/api/tasks/${uploadPayload.data.taskId}`, {
    method: "DELETE",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${taskCookieValue}`,
      origin: "http://localhost",
      "x-task-csrf": "wrong-token",
    },
  }),
  {
    params: Promise.resolve({ taskId: uploadPayload.data.taskId }),
  },
);
assert.equal(invalidDeleteResponse.status, 403);
const invalidDeletePayload = await invalidDeleteResponse.json();
assert.equal(invalidDeletePayload.error.code, "csrf_invalid");

const parsedTamperedTaskCookie = parseStoredTaskContext(tamperedTaskCookie);
const unauthorizedDeleteResponse = await deleteTask(
  new Request(`http://localhost/api/tasks/${uploadPayload.data.taskId}`, {
    method: "DELETE",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${tamperedTaskCookie}`,
      origin: "http://localhost",
      "x-task-csrf": parsedTamperedTaskCookie.csrfToken,
    },
  }),
  {
    params: Promise.resolve({ taskId: uploadPayload.data.taskId }),
  },
);
assert.equal(unauthorizedDeleteResponse.status, 401);
const unauthorizedDeletePayload = await unauthorizedDeleteResponse.json();
assert.equal(unauthorizedDeletePayload.error.code, "unauthorized_task_access");

const deleteResponse = await deleteTask(
  new Request(`http://localhost/api/tasks/${uploadPayload.data.taskId}`, {
    method: "DELETE",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${taskCookieValue}`,
      origin: "http://localhost",
      "x-task-csrf": parsedTaskCookie.csrfToken,
    },
  }),
  {
    params: Promise.resolve({ taskId: uploadPayload.data.taskId }),
  },
);
assert.equal(deleteResponse.status, 200);
const deletePayload = await deleteResponse.json();
assert.equal(deletePayload.data.taskId, uploadPayload.data.taskId);
assert.equal(deletePayload.data.reason, "user_requested");
const deletedSetCookieHeader = deleteResponse.headers.get("set-cookie");
assert.ok(deletedSetCookieHeader);
const deletedCookieValue = getCookieValueFromSetCookie(deletedSetCookieHeader);
const parsedDeletedCookie = parseStoredTaskContext(deletedCookieValue);
assert.equal(parsedDeletedCookie?.kind, "deleted");
assert.equal(parsedDeletedCookie?.taskId, uploadPayload.data.taskId);
assert.equal(parsedDeletedCookie?.reason, "user_requested");
assert.equal(
  await getTaskRepository().findTaskRecordById(uploadPayload.data.taskId),
  null,
);

const deletedTaskResponse = await getTask(
  new Request(`http://localhost/api/tasks/${uploadPayload.data.taskId}`, {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${deletedCookieValue}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: uploadPayload.data.taskId }),
  },
);
assert.equal(deletedTaskResponse.status, 410);
const deletedTaskPayload = await deletedTaskResponse.json();
assert.equal(deletedTaskPayload.error.code, "task_deleted");

resetTaskRepositoryForTests();
const expiredIssuedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
await getTaskRepository().createTaskRecord({
  taskId: "task-expired",
  sessionId: "session-expired",
  mode: "workbench",
  status: "completed",
  stage: "export",
  progressPercent: 100,
  statusMessage: "任务已完成。",
  nextStep: "任务进入保留期。",
  retryable: false,
  accessTokenHash: getTaskAccessTokenHash("expired-access"),
  originalFileName: "expired.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  byteSize: 1024,
  checksumSha256: "expired-checksum",
  bucketName: "memory-private-originals",
  objectKey: "expired/original.docx",
  storageProvider: "memory",
  createdAt: new Date(expiredIssuedAt),
});
const expiredContext = parseStoredTaskContext(
  serializeTaskContext({
    kind: "task",
    sessionId: "session-expired",
    taskId: "task-expired",
    accessToken: "expired-access",
    csrfToken: "expired-csrf",
    mode: "workbench",
    issuedAt: expiredIssuedAt,
  }),
);
const expiredRead = await readAuthorizedTask({
  taskId: "task-expired",
  storedContext: expiredContext,
});
assert.equal("data" in expiredRead, false);
assert.equal(expiredRead.status, 410);
assert.equal(expiredRead.error, "task_expired");
const networkFailureResult = await submitUploadRequest({
  document: validDocx,
  csrfToken: "csrf-token",
  fetchImpl: async () => {
    throw new Error("network down");
  },
});
assert.equal(networkFailureResult.kind, "error");
assert.equal(networkFailureResult.code, "upload_unavailable");

const malformedSuccessResult = await submitUploadRequest({
  document: validDocx,
  csrfToken: "csrf-token",
  fetchImpl: async () =>
    new Response("not-json", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
});
assert.equal(malformedSuccessResult.kind, "error");
assert.equal(malformedSuccessResult.code, "upload_unavailable");

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

console.log("task-context and upload tests passed");


