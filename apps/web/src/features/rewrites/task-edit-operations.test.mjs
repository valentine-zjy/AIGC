import assert from "node:assert/strict";

import {
  getEditOperationRepository,
  getRewriteOptionRepository,
  getRiskFindingRepository,
  getTaskRepository,
  resetEditOperationRepositoryForTests,
  resetRewriteOptionRepositoryForTests,
  resetRiskFindingRepositoryForTests,
  resetTaskRepositoryForTests,
} from "@ai-rewrite/db";

import { POST as postTaskFeedback } from "../../app/api/tasks/[taskId]/feedback/route.ts";
import {
  GET as getTaskEditOperations,
  POST as postTaskEditOperation,
} from "../../app/api/tasks/[taskId]/edit-operations/route.ts";
import { POST as postTaskRollback } from "../../app/api/tasks/[taskId]/rollback/route.ts";
import { readAuthorizedTaskEditHistory } from "./task-edit-history-service.ts";
import {
  buildTaskEditHistoryQueryKey,
  buildTaskEditHistoryRequestPath,
} from "./task-edit-history-query.ts";
import { applyTaskEditOperationDecision } from "./task-edit-operations-service.ts";
import { applyTaskFeedback } from "./task-feedback-service.ts";
import { rollbackTaskEdit } from "./task-rollback-service.ts";
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
  mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  stage = "scan",
}) {
  return getTaskRepository().createTaskRecord({
    taskId,
    sessionId,
    mode: "workbench",
    status: "completed",
    stage,
    progressPercent: 100,
    statusMessage: "Upload, parse, and scan stages are complete.",
    nextStep: "You can continue reviewing the current paragraph.",
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

async function seedEditableTask() {
  await createTaskRecord({
    taskId: "task-edit-ready",
    sessionId: "session-edit-ready",
    accessToken: "edit-ready-token",
  });
  await getRiskFindingRepository().replaceTaskRiskFindings({
    taskId: "task-edit-ready",
    items: [
      {
        findingId: "risk-1",
        paragraphId: "p-003",
        riskLevel: "high",
        issueType: "background_template",
        issueTypeLabel: "Background template",
        issueTypeSummary: "Background paragraph still sounds templated.",
        excerpt:
          "Recent studies continue to accumulate, but the framing remains generic.",
        score: 97,
        handlingStatus: "pending",
      },
      {
        findingId: "risk-2",
        paragraphId: "p-011",
        riskLevel: "high",
        issueType: "method_boilerplate",
        issueTypeLabel: "Method boilerplate",
        issueTypeSummary: "Method paragraph uses stock phrasing.",
        excerpt:
          "This study uses literature analysis, comparison, and case induction.",
        score: 91,
        handlingStatus: "pending",
      },
    ],
  });
  await getRewriteOptionRepository().replaceTaskRewriteOptions({
    taskId: "task-edit-ready",
    items: [
      {
        optionId: "rewrite-accept",
        paragraphId: "p-003",
        optionRank: 1,
        title: "Tie the background to the research gap",
        strategyLabel: "Stronger problem framing",
        candidateText:
          "Existing studies have accumulated useful observations, but their explanation of the mechanism remains thin, which is the gap this paper addresses.",
        rationale: "Replace generic background summary with a concrete research gap.",
        diffSummary: "Adds a specific missing-mechanism claim.",
        isRecommended: true,
      },
      {
        optionId: "rewrite-reject",
        paragraphId: "p-011",
        optionRank: 1,
        title: "Turn method names into an execution sequence",
        strategyLabel: "Concrete workflow",
        candidateText:
          "This paper first reviews the core literature and then compares cross-case material to clarify the argument path.",
        rationale: "Replace stacked method labels with a readable sequence of actions.",
        diffSummary: "Moves from abstract method labels to concrete steps.",
        isRecommended: true,
      },
    ],
  });
}

async function resetAndSeedEditableTask() {
  resetTaskRepositoryForTests();
  resetRiskFindingRepositoryForTests();
  resetRewriteOptionRepositoryForTests();
  resetEditOperationRepositoryForTests();
  await seedEditableTask();
}

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test";

await resetAndSeedEditableTask();
const readyContext = createTaskContextCookie({
  taskId: "task-edit-ready",
  sessionId: "session-edit-ready",
  accessToken: "edit-ready-token",
});

const emptyHistoryResult = await readAuthorizedTaskEditHistory({
  taskId: "task-edit-ready",
  paragraphId: "p-003",
  storedContext: readyContext,
});
assert.equal("data" in emptyHistoryResult, true);
assert.deepEqual(emptyHistoryResult.data.counts, {
  pending: 2,
  accepted: 0,
  rejected: 0,
  ignored: 0,
});
assert.equal(emptyHistoryResult.data.processedParagraphs.length, 0);
assert.equal(emptyHistoryResult.data.selectedParagraphHistory.length, 0);
assert.equal(emptyHistoryResult.data.emptyState?.title, "No decisions recorded yet");

const acceptResult = await applyTaskEditOperationDecision({
  taskId: "task-edit-ready",
  paragraphId: "p-003",
  optionId: "rewrite-accept",
  action: "accept",
  storedContext: readyContext,
});
assert.equal("data" in acceptResult, true);
assert.equal(acceptResult.data.handlingStatus, "accepted");
assert.equal(acceptResult.data.operation.operationType, "accept_suggestion");
assert.equal(
  acceptResult.data.operation.appliedText?.includes("gap this paper addresses"),
  true,
);
assert.equal(acceptResult.data.nextParagraphId, "p-011");

const rejectResult = await applyTaskEditOperationDecision({
  taskId: "task-edit-ready",
  paragraphId: "p-011",
  optionId: "rewrite-reject",
  action: "reject",
  storedContext: readyContext,
});
assert.equal("data" in rejectResult, true);
assert.equal(rejectResult.data.handlingStatus, "rejected");
assert.equal(rejectResult.data.operation.operationType, "reject_suggestion");
assert.equal(rejectResult.data.operation.appliedText, null);
assert.equal(rejectResult.data.nextParagraphId, null);
const editOperations = await getEditOperationRepository().listTaskEditOperations({
  taskId: "task-edit-ready",
});
assert.equal(editOperations.length, 2);

const historyResult = await readAuthorizedTaskEditHistory({
  taskId: "task-edit-ready",
  paragraphId: "p-003",
  storedContext: readyContext,
});
assert.equal("data" in historyResult, true);
assert.deepEqual(historyResult.data.counts, {
  pending: 0,
  accepted: 1,
  rejected: 1,
  ignored: 0,
});
assert.equal(historyResult.data.selectedParagraphHistory[0]?.operationType, "accept_suggestion");

const routeHistoryResponse = await getTaskEditOperations(
  new Request(
    "http://localhost/api/tasks/task-edit-ready/edit-operations?paragraphId=p-003",
    { method: "GET", headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}` } },
  ),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(routeHistoryResponse.status, 200);

const invalidHistoryQueryResponse = await getTaskEditOperations(
  new Request(
    "http://localhost/api/tasks/task-edit-ready/edit-operations?paragraphId=",
    { method: "GET", headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}` } },
  ),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(invalidHistoryQueryResponse.status, 400);
const invalidHistoryQueryPayload = await invalidHistoryQueryResponse.json();
assert.equal(invalidHistoryQueryPayload.error.code, "invalid_task_edit_history_query");

const routeAcceptResponse = await postTaskEditOperation(
  new Request("http://localhost/api/tasks/task-edit-ready/edit-operations", {
    method: "POST",
    headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}`, "content-type": "application/json" },
    body: JSON.stringify({ paragraphId: "p-003", optionId: "rewrite-accept", action: "accept" }),
  }),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(routeAcceptResponse.status, 200);

const invalidPayloadResponse = await postTaskEditOperation(
  new Request("http://localhost/api/tasks/task-edit-ready/edit-operations", {
    method: "POST",
    headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}`, "content-type": "application/json" },
    body: JSON.stringify({ paragraphId: "p-003" }),
  }),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(invalidPayloadResponse.status, 400);
const invalidPayload = await invalidPayloadResponse.json();
assert.equal(invalidPayload.error.code, "invalid_task_edit_operation");

await resetAndSeedEditableTask();
const feedbackContext = createTaskContextCookie({ taskId: "task-edit-ready", sessionId: "session-edit-ready", accessToken: "edit-ready-token" });
const falsePositiveResult = await applyTaskFeedback({ taskId: "task-edit-ready", paragraphId: "p-003", optionId: "rewrite-accept", action: "mark_false_positive", storedContext: feedbackContext });
assert.equal("data" in falsePositiveResult, true);
assert.equal(falsePositiveResult.data.handlingStatus, "ignored");
assert.equal(falsePositiveResult.data.operation.operationType, "mark_false_positive");
assert.equal(falsePositiveResult.data.nextParagraphId, "p-011");
const feedbackRouteResponse = await postTaskFeedback(
  new Request("http://localhost/api/tasks/task-edit-ready/feedback", {
    method: "POST",
    headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(feedbackContext)}`, "content-type": "application/json" },
    body: JSON.stringify({ paragraphId: "p-011", optionId: "rewrite-reject", action: "ignore_paragraph" }),
  }),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(feedbackRouteResponse.status, 200);
const invalidFeedbackResponse = await postTaskFeedback(
  new Request("http://localhost/api/tasks/task-edit-ready/feedback", {
    method: "POST",
    headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(feedbackContext)}`, "content-type": "application/json" },
    body: JSON.stringify({ paragraphId: "p-003" }),
  }),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(invalidFeedbackResponse.status, 400);
const invalidFeedbackPayload = await invalidFeedbackResponse.json();
assert.equal(invalidFeedbackPayload.error.code, "invalid_task_feedback");

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
resetRewriteOptionRepositoryForTests();
resetEditOperationRepositoryForTests();
await createTaskRecord({
  taskId: "task-edit-rewrite-ready",
  sessionId: "session-edit-rewrite-ready",
  accessToken: "edit-rewrite-ready-token",
  stage: "rewrite",
});
await getRiskFindingRepository().replaceTaskRiskFindings({
  taskId: "task-edit-rewrite-ready",
  items: [
    {
      findingId: "rewrite-risk-1",
      paragraphId: "p-101",
      riskLevel: "high",
      issueType: "background_template",
      issueTypeLabel: "Background template",
      issueTypeSummary: "Rewrite-stage paragraph is still editable.",
      excerpt: "Rewrite-ready paragraph.",
      score: 88,
      handlingStatus: "pending",
    },
  ],
});
await getRewriteOptionRepository().replaceTaskRewriteOptions({
  taskId: "task-edit-rewrite-ready",
  items: [
    {
      optionId: "rewrite-ready-option",
      paragraphId: "p-101",
      optionRank: 1,
      title: "Rewrite-ready option",
      strategyLabel: "Targeted improvement",
      candidateText: "Rewrite-stage suggestion remains actionable after one-click preview.",
      rationale: "Keep local refinement available after one-click preview.",
      diffSummary: "Allows continued editing in rewrite stage.",
      isRecommended: true,
    },
  ],
});
const rewriteStageContext = createTaskContextCookie({
  taskId: "task-edit-rewrite-ready",
  sessionId: "session-edit-rewrite-ready",
  accessToken: "edit-rewrite-ready-token",
});
const rewriteStageAcceptResult = await applyTaskEditOperationDecision({
  taskId: "task-edit-rewrite-ready",
  paragraphId: "p-101",
  optionId: "rewrite-ready-option",
  action: "accept",
  storedContext: rewriteStageContext,
});
assert.equal("data" in rewriteStageAcceptResult, true);
assert.equal(rewriteStageAcceptResult.data.handlingStatus, "accepted");
const rewriteStageFeedbackResult = await applyTaskFeedback({
  taskId: "task-edit-rewrite-ready",
  paragraphId: "p-101",
  optionId: "rewrite-ready-option",
  action: "mark_unhelpful",
  storedContext: rewriteStageContext,
});
assert.equal("data" in rewriteStageFeedbackResult, true);
assert.equal(rewriteStageFeedbackResult.data.handlingStatus, "ignored");

await resetAndSeedEditableTask();
const rollbackContext = createTaskContextCookie({ taskId: "task-edit-ready", sessionId: "session-edit-ready", accessToken: "edit-ready-token" });
await applyTaskEditOperationDecision({ taskId: "task-edit-ready", paragraphId: "p-003", optionId: "rewrite-accept", action: "accept", storedContext: rollbackContext });
const rollbackResult = await rollbackTaskEdit({ taskId: "task-edit-ready", paragraphId: "p-003", storedContext: rollbackContext });
assert.equal("data" in rollbackResult, true);
assert.equal(rollbackResult.data.handlingStatus, "pending");
assert.equal(rollbackResult.data.operation.operationType, "rollback_edit");
const rollbackHistoryResult = await readAuthorizedTaskEditHistory({ taskId: "task-edit-ready", paragraphId: "p-003", storedContext: rollbackContext });
assert.equal("data" in rollbackHistoryResult, true);
assert.equal(rollbackHistoryResult.data.selectedParagraphHistory.length, 2);
assert.equal(rollbackHistoryResult.data.selectedParagraphHistory.at(-1)?.operationType, "rollback_edit");
const rollbackRouteResponse = await postTaskRollback(
  new Request("http://localhost/api/tasks/task-edit-ready/rollback", {
    method: "POST",
    headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(rollbackContext)}`, "content-type": "application/json" },
    body: JSON.stringify({ paragraphId: "p-003" }),
  }),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(rollbackRouteResponse.status, 409);
const rollbackRoutePayload = await rollbackRouteResponse.json();
assert.equal(rollbackRoutePayload.error.code, "rollback_not_available");
const invalidRollbackResponse = await postTaskRollback(
  new Request("http://localhost/api/tasks/task-edit-ready/rollback", {
    method: "POST",
    headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(rollbackContext)}`, "content-type": "application/json" },
    body: JSON.stringify({}),
  }),
  { params: Promise.resolve({ taskId: "task-edit-ready" }) },
);
assert.equal(invalidRollbackResponse.status, 400);
const invalidRollbackPayload = await invalidRollbackResponse.json();
assert.equal(invalidRollbackPayload.error.code, "invalid_task_rollback");

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
resetRewriteOptionRepositoryForTests();
resetEditOperationRepositoryForTests();
await createTaskRecord({ taskId: "task-edit-pdf", sessionId: "session-edit-pdf", accessToken: "edit-pdf-token", mimeType: "application/pdf" });
const pdfContext = createTaskContextCookie({ taskId: "task-edit-pdf", sessionId: "session-edit-pdf", accessToken: "edit-pdf-token" });
const pdfResult = await applyTaskEditOperationDecision({ taskId: "task-edit-pdf", paragraphId: "p-003", optionId: "rewrite-accept", action: "accept", storedContext: pdfContext });
assert.equal("status" in pdfResult, true);
assert.equal(pdfResult.status, 409);
assert.equal(pdfResult.error, "task_edit_not_allowed");

await resetAndSeedEditableTask();
const tamperedContext = createTaskAccessContext({ taskId: "task-edit-ready", sessionId: "session-edit-ready", mode: "workbench", accessToken: "tampered-token" });
const unauthorizedHistoryResponse = await getTaskEditOperations(new Request("http://localhost/api/tasks/task-edit-ready/edit-operations", { method: "GET", headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(tamperedContext)}` } }), { params: Promise.resolve({ taskId: "task-edit-ready" }) });
assert.equal(unauthorizedHistoryResponse.status, 401);
const unauthorizedEditResponse = await postTaskEditOperation(new Request("http://localhost/api/tasks/task-edit-ready/edit-operations", { method: "POST", headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(tamperedContext)}`, "content-type": "application/json" }, body: JSON.stringify({ paragraphId: "p-003", optionId: "rewrite-accept", action: "accept" }) }), { params: Promise.resolve({ taskId: "task-edit-ready" }) });
assert.equal(unauthorizedEditResponse.status, 401);
const unauthorizedFeedbackResponse = await postTaskFeedback(new Request("http://localhost/api/tasks/task-edit-ready/feedback", { method: "POST", headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(tamperedContext)}`, "content-type": "application/json" }, body: JSON.stringify({ paragraphId: "p-003", optionId: "rewrite-accept", action: "mark_unhelpful" }) }), { params: Promise.resolve({ taskId: "task-edit-ready" }) });
assert.equal(unauthorizedFeedbackResponse.status, 401);
const unauthorizedRollbackResponse = await postTaskRollback(new Request("http://localhost/api/tasks/task-edit-ready/rollback", { method: "POST", headers: { cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(tamperedContext)}`, "content-type": "application/json" }, body: JSON.stringify({ paragraphId: "p-003" }) }), { params: Promise.resolve({ taskId: "task-edit-ready" }) });
assert.equal(unauthorizedRollbackResponse.status, 401);

assert.deepEqual(buildTaskEditHistoryQueryKey("task-edit-ready", "p-003"), ["task-edit-history", "task-edit-ready", "p-003"]);
assert.equal(buildTaskEditHistoryRequestPath("task-edit-ready", "p-003"), "/api/tasks/task-edit-ready/edit-operations?paragraphId=p-003");
assert.equal(buildTaskEditHistoryRequestPath("task-edit-ready", null), "/api/tasks/task-edit-ready/edit-operations");

if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
console.log("task edit operations tests passed");
