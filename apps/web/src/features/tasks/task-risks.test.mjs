import assert from "node:assert/strict";

import {
  getRiskFindingRepository,
  getTaskRepository,
  resetRiskFindingRepositoryForTests,
  resetTaskRepositoryForTests,
} from "@ai-rewrite/db";

import { GET as getTaskRisks } from "../../app/api/tasks/[taskId]/risks/route.ts";
import {
  buildTaskRiskWorkbenchViewModel,
  handlingStatusLabels,
  issueTypeLabels,
  riskLevelLabels,
  sortModeLabels,
} from "../diagnosis/task-risk-workbench-view-model.ts";
import {
  buildTaskRisksQueryKey,
  buildTaskRisksRequestPath,
  normalizeTaskRiskQueryFilters,
} from "./task-risks-query.ts";
import { readAuthorizedTaskRisks } from "./task-risks-service.ts";
import { createTaskStatusUiStore } from "./task-status-ui-store.ts";
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
resetRiskFindingRepositoryForTests();
await createTaskRecord({
  taskId: "task-risk-pending",
  sessionId: "session-risk-pending",
  accessToken: "risk-pending-token",
  status: "queued",
  stage: "upload",
  progressPercent: 12,
  statusMessage: "Task accepted and waiting in queue.",
  nextStep: "Keep this page open while the task progresses.",
});
const pendingContext = createTaskContextCookie({
  taskId: "task-risk-pending",
  sessionId: "session-risk-pending",
  accessToken: "risk-pending-token",
});
const pendingResult = await readAuthorizedTaskRisks({
  taskId: "task-risk-pending",
  storedContext: pendingContext,
});
assert.equal("data" in pendingResult, true);
assert.equal(pendingResult.data.state, "pending");
assert.equal(pendingResult.data.items.length, 0);
assert.equal(typeof pendingResult.data.message, "string");
assert.ok(pendingResult.data.message.length > 0);

resetTaskRepositoryForTests();
resetRiskFindingRepositoryForTests();
await createTaskRecord({
  taskId: "task-risk-ready",
  sessionId: "session-risk-ready",
  accessToken: "risk-ready-token",
  status: "completed",
  stage: "scan",
  progressPercent: 100,
  statusMessage: "Upload, parsing, and scan stages are complete.",
  nextStep: "You can review the first risk results now.",
});
await getRiskFindingRepository().replaceTaskRiskFindings({
  taskId: "task-risk-ready",
  items: [
    {
      findingId: "risk-2",
      paragraphId: "p-020",
      riskLevel: "medium",
      issueType: "conclusion_template",
      issueTypeLabel: issueTypeLabels.conclusion_template,
      issueTypeSummary: "Conclusion paragraph sounds templated.",
      excerpt: "Overall, this study provides a useful reference for future work.",
      score: 81,
      handlingStatus: "pending",
    },
    {
      findingId: "risk-3",
      paragraphId: "p-030",
      riskLevel: "high",
      issueType: "background_template",
      issueTypeLabel: issueTypeLabels.background_template,
      issueTypeSummary: "Background paragraph is too formulaic.",
      excerpt: "In recent years, related research has continued to grow.",
      score: 89,
      handlingStatus: "accepted",
    },
    {
      findingId: "risk-1",
      paragraphId: "p-010",
      riskLevel: "high",
      issueType: "method_boilerplate",
      issueTypeLabel: issueTypeLabels.method_boilerplate,
      issueTypeSummary: "Method paragraph relies on boilerplate wording.",
      excerpt: "This study uses literature analysis and case comparison.",
      score: 95,
      handlingStatus: "pending",
    },
  ],
});
const readyContext = createTaskContextCookie({
  taskId: "task-risk-ready",
  sessionId: "session-risk-ready",
  accessToken: "risk-ready-token",
});
const readyResult = await readAuthorizedTaskRisks({
  taskId: "task-risk-ready",
  storedContext: readyContext,
  filters: {
    riskLevel: "all",
    status: "all",
    issueType: "all",
    sortBy: "recommended",
    limit: 10,
  },
});
assert.equal("data" in readyResult, true);
assert.equal(readyResult.data.state, "ready");
assert.equal(readyResult.data.items.length, 3);
assert.equal(readyResult.data.items[0].paragraphId, "p-010");
assert.equal(readyResult.data.items[1].paragraphId, "p-030");
assert.equal(readyResult.data.items[2].paragraphId, "p-020");
assert.equal(readyResult.data.generatedAt !== null, true);
assert.equal(typeof readyResult.data.message, "string");
assert.ok(readyResult.data.message.length > 0);

const issueTypeFilteredResult = await readAuthorizedTaskRisks({
  taskId: "task-risk-ready",
  storedContext: readyContext,
  filters: {
    riskLevel: "all",
    status: "all",
    issueType: "method_boilerplate",
    sortBy: "recommended",
    limit: 10,
  },
});
assert.equal("data" in issueTypeFilteredResult, true);
assert.equal(issueTypeFilteredResult.data.items.length, 1);
assert.equal(issueTypeFilteredResult.data.items[0].issueType, "method_boilerplate");

const paragraphSortedResult = await readAuthorizedTaskRisks({
  taskId: "task-risk-ready",
  storedContext: readyContext,
  filters: {
    riskLevel: "all",
    status: "all",
    issueType: "all",
    sortBy: "paragraph_asc",
    limit: 10,
  },
});
assert.equal("data" in paragraphSortedResult, true);
assert.equal(paragraphSortedResult.data.items[0].paragraphId, "p-010");
assert.equal(paragraphSortedResult.data.items[1].paragraphId, "p-020");
assert.equal(paragraphSortedResult.data.items[2].paragraphId, "p-030");

const authorizedResponse = await getTaskRisks(
  new Request(
    "http://localhost/api/tasks/task-risk-ready/risks?limit=10&issueType=method_boilerplate&sortBy=recommended",
    {
      method: "GET",
      headers: {
        cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(readyContext)}`,
      },
    },
  ),
  {
    params: Promise.resolve({ taskId: "task-risk-ready" }),
  },
);
assert.equal(authorizedResponse.status, 200);
const authorizedPayload = await authorizedResponse.json();
assert.equal(authorizedPayload.data.state, "ready");
assert.equal(authorizedPayload.data.items[0].paragraphId, "p-010");
assert.equal(authorizedPayload.data.items[0].issueType, "method_boilerplate");

const unauthorizedResponse = await getTaskRisks(
  new Request("http://localhost/api/tasks/task-risk-ready/risks?limit=10", {
    method: "GET",
    headers: {
      cookie: `${TASK_CONTEXT_COOKIE}=${serializeTaskContext(
        createTaskAccessContext({
          taskId: "task-risk-ready",
          sessionId: "session-risk-ready",
          mode: "workbench",
          accessToken: "tampered-token",
        }),
      )}`,
    },
  }),
  {
    params: Promise.resolve({ taskId: "task-risk-ready" }),
  },
);
assert.equal(unauthorizedResponse.status, 401);
const unauthorizedPayload = await unauthorizedResponse.json();
assert.equal(unauthorizedPayload.error.code, "unauthorized_task_access");

const normalizedFilters = normalizeTaskRiskQueryFilters({
  riskLevel: "high",
  status: "pending",
  issueType: "method_boilerplate",
  sortBy: "recommended",
  limit: 8,
});
assert.deepEqual(normalizedFilters, {
  riskLevel: "high",
  status: "pending",
  issueType: "method_boilerplate",
  sortBy: "recommended",
  limit: 8,
});
assert.deepEqual(buildTaskRisksQueryKey("task-risk-ready", normalizedFilters), [
  "task-risks",
  "task-risk-ready",
  normalizedFilters,
]);
assert.equal(
  buildTaskRisksRequestPath("task-risk-ready", normalizedFilters),
  "/api/tasks/task-risk-ready/risks?limit=8&sortBy=recommended&riskLevel=high&status=pending&issueType=method_boilerplate",
);

const readyViewModel = buildTaskRiskWorkbenchViewModel({
  result: readyResult.data,
  selectedParagraphId: "p-020",
});
assert.equal(readyViewModel.title, "High-risk workbench");
assert.equal(readyViewModel.selectedFinding?.paragraphId, "p-020");
assert.equal(readyViewModel.selectedRiskLevelLabel, riskLevelLabels.medium);
assert.equal(
  readyViewModel.selectedHandlingStatusLabel,
  handlingStatusLabels.pending,
);
assert.equal(
  readyViewModel.selectedIssueTypeLabel,
  issueTypeLabels.conclusion_template,
);
assert.equal(readyViewModel.currentSortModeLabel, sortModeLabels.recommended);
assert.equal(readyViewModel.nextPendingParagraphId, "p-010");

const emptyViewModel = buildTaskRiskWorkbenchViewModel({
  result: {
    taskId: "task-risk-empty",
    state: "ready",
    message: "No matching results.",
    generatedAt: null,
    totalCount: 0,
    filters: {
      riskLevel: "all",
      status: "all",
      issueType: "all",
      sortBy: "recommended",
      limit: 10,
    },
    items: [],
  },
  selectedParagraphId: null,
});
assert.equal(emptyViewModel.title, "No matching risks");
assert.equal(emptyViewModel.selectedFinding, null);

const taskStatusUiStore = createTaskStatusUiStore();
assert.deepEqual(taskStatusUiStore.getState().filters, {
  riskLevel: "all",
  status: "all",
  issueType: "all",
  sortBy: "recommended",
});
taskStatusUiStore.getState().setRiskLevelFilter("high");
taskStatusUiStore.getState().setStatusFilter("pending");
taskStatusUiStore.getState().setIssueTypeFilter("method_boilerplate");
taskStatusUiStore.getState().setSortBy("paragraph_asc");
taskStatusUiStore.getState().setSelectedParagraphId("p-010");
taskStatusUiStore.getState().setPanelMode("detail");
assert.deepEqual(taskStatusUiStore.getState().filters, {
  riskLevel: "high",
  status: "pending",
  issueType: "method_boilerplate",
  sortBy: "paragraph_asc",
});
assert.equal(taskStatusUiStore.getState().selectedParagraphId, "p-010");
assert.equal(taskStatusUiStore.getState().panelMode, "detail");
taskStatusUiStore.getState().resetFilters();
assert.deepEqual(taskStatusUiStore.getState().filters, {
  riskLevel: "all",
  status: "all",
  issueType: "all",
  sortBy: "recommended",
});

if (originalNodeEnv === undefined) {
  delete process.env.NODE_ENV;
} else {
  process.env.NODE_ENV = originalNodeEnv;
}

console.log("task risks tests passed");
