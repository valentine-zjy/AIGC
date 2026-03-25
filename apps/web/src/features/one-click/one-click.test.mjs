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
  GET as getOneClickState,
  POST as postOneClickAction,
} from "../../app/api/tasks/[taskId]/one-click/route.ts";
import {
  applyAuthorizedOneClickAction,
  readAuthorizedOneClickState,
} from "./one-click-service.ts";
import { readOneClickSession } from "./one-click-session-repository.ts";
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
      createTaskAccessContext({ sessionId, taskId, mode: "one-click", accessToken }),
    ),
  );
}

async function createTaskRecord({ taskId, sessionId, accessToken, mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document", mode = "one-click" }) {
  return getTaskRepository().createTaskRecord({
    taskId,
    sessionId,
    mode,
    status: "completed",
    stage: "scan",
    progressPercent: 100,
    statusMessage: "Scan complete.",
    nextStep: "Review one-click preview options.",
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

async function seedOneClickTask(taskId) {
  await getRiskFindingRepository().replaceTaskRiskFindings({
    taskId,
    items: [
      {
        findingId: `${taskId}-risk-1`,
        paragraphId: "p-001",
        riskLevel: "high",
        issueType: "background_template",
        issueTypeLabel: "Background template",
        issueTypeSummary: "Background paragraph sounds generic.",
        excerpt: "Recent studies continue to accumulate.",
        score: 95,
        handlingStatus: "pending",
      },
      {
        findingId: `${taskId}-risk-2`,
        paragraphId: "p-002",
        riskLevel: "medium",
        issueType: "method_boilerplate",
        issueTypeLabel: "Method boilerplate",
        issueTypeSummary: "Method paragraph is too stock.",
        excerpt: "This study uses literature analysis.",
        score: 85,
        handlingStatus: "pending",
      },
    ],
  });
  await getRewriteOptionRepository().replaceTaskRewriteOptions({
    taskId,
    items: [
      {
        optionId: `${taskId}-opt-1`,
        paragraphId: "p-001",
        optionRank: 1,
        title: "Sharpen the research gap",
        strategyLabel: "Problem framing",
        candidateText: "Existing studies accumulate observations, but their mechanism-level explanation remains incomplete.",
        rationale: "Make the gap concrete.",
        diffSummary: "Adds a missing-mechanism claim.",
        isRecommended: true,
      },
      {
        optionId: `${taskId}-opt-2`,
        paragraphId: "p-002",
        optionRank: 1,
        title: "Turn methods into steps",
        strategyLabel: "Execution sequence",
        candidateText: "This paper first reviews core literature and then compares case material to test the argument path.",
        rationale: "Replace method labels with actions.",
        diffSummary: "Moves from labels to steps.",
        isRecommended: true,
      },
    ],
  });
  await getDocumentSegmentRepository().replaceTaskDocumentSegments({
    taskId,
    items: [
      {
        paragraphId: "p-001",
        originalText: "Recent studies continue to accumulate.",
        diagnosisReason: "Too generic.",
        confidenceBucket: "high_confidence_issue",
        confidenceLabel: "High confidence",
        confidenceSummary: "Confident template signal.",
        contextStatus: "full",
        contextStatusLabel: "Full context",
      },
      {
        paragraphId: "p-002",
        originalText: "This study uses literature analysis.",
        diagnosisReason: "Method phrasing is stock.",
        confidenceBucket: "high_confidence_issue",
        confidenceLabel: "High confidence",
        confidenceSummary: "Confident stock phrasing signal.",
        contextStatus: "full",
        contextStatusLabel: "Full context",
      },
    ],
  });
}

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
resetRewriteOptionRepositoryForTests();
resetDocumentSegmentRepositoryForTests();
const taskId = `task-one-click-${Date.now()}`;
await createTaskRecord({ taskId, sessionId: "session-one-click", accessToken: "one-click-token" });
await seedOneClickTask(taskId);
const context = createTaskContextCookie({ taskId, sessionId: "session-one-click", accessToken: "one-click-token" });

const reviewState = await readAuthorizedOneClickState({ taskId, storedContext: context });
assert.equal("data" in reviewState, true);
assert.equal(reviewState.data.state, "review");
assert.equal(reviewState.data.canStart, true);
assert.equal(reviewState.data.preview, null);

const startResult = await applyAuthorizedOneClickAction({ taskId, action: "start", storedContext: context });
assert.equal("data" in startResult, true);
assert.equal(startResult.data.state, "processing");

await new Promise((resolve) => setTimeout(resolve, 50));
const readyState = await readAuthorizedOneClickState({ taskId, storedContext: context });
assert.equal("data" in readyState, true);
assert.equal(readyState.data.state, "ready");
assert.equal(readyState.data.preview?.optimizedCount, 2);
assert.equal(readyState.data.canContinueRefine, true);
const readySession = await readOneClickSession(taskId);
assert.equal(readySession?.events.length, 2);
assert.equal(readySession?.events[0]?.eventType, "start_preview");
assert.equal(readySession?.events[1]?.eventType, "preview_ready");

const routeReadyResponse = await getOneClickState(
  new Request(`http://localhost/api/tasks/${taskId}/one-click`, {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(context)}`,
    },
  }),
  { params: Promise.resolve({ taskId }) },
);
assert.equal(routeReadyResponse.status, 200);

const rollbackResponse = await postOneClickAction(
  new Request(`http://localhost/api/tasks/${taskId}/one-click`, {
    method: "POST",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(context)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action: "rollback" }),
  }),
  { params: Promise.resolve({ taskId }) },
);
assert.equal(rollbackResponse.status, 200);
const rolledBackState = await readAuthorizedOneClickState({ taskId, storedContext: context });
assert.equal("data" in rolledBackState, true);
assert.equal(rolledBackState.data.state, "review");
assert.equal(rolledBackState.data.canStart, true);
const rolledBackSession = await readOneClickSession(taskId);
assert.equal(rolledBackSession?.events.at(-1)?.eventType, "rollback_preview");

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
resetRewriteOptionRepositoryForTests();
resetDocumentSegmentRepositoryForTests();
const blockedTaskId = `task-one-click-pdf-${Date.now()}`;
await createTaskRecord({ taskId: blockedTaskId, sessionId: "session-one-click-pdf", accessToken: "one-click-pdf-token", mimeType: "application/pdf" });
await seedOneClickTask(blockedTaskId);
const blockedContext = createTaskContextCookie({ taskId: blockedTaskId, sessionId: "session-one-click-pdf", accessToken: "one-click-pdf-token" });
const blockedState = await readAuthorizedOneClickState({ taskId: blockedTaskId, storedContext: blockedContext });
assert.equal("data" in blockedState, true);
assert.equal(blockedState.data.canStart, false);
assert.match(blockedState.data.blockedReason ?? "", /PDF/u);

const unauthorizedResponse = await getOneClickState(
  new Request(`http://localhost/api/tasks/${blockedTaskId}/one-click`, {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(
        createTaskAccessContext({ taskId: blockedTaskId, sessionId: "session-one-click-pdf", mode: "one-click", accessToken: "tampered" }),
      )}`,
    },
  }),
  { params: Promise.resolve({ taskId: blockedTaskId }) },
);
assert.equal(unauthorizedResponse.status, 401);

console.log("one click tests passed");
