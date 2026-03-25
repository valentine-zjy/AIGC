import assert from "node:assert/strict";

import { createTaskAccessContext, createTaskAccessToken } from "../../task-session.ts";
import {
  buildDataPolicyItems,
  getTaskStageGuidance,
  getUploadStageGuidance,
  sharedAccessScopeCopy,
} from "./data-governance-copy.ts";
import { formatCapabilityMatrix } from "./format-capability-matrix.ts";
import { readAuthorizedTask } from "../tasks/task-service.ts";
import {
  getSupportedUploadFormat,
  uploadModeLabels,
} from "../upload/upload-constraints.ts";

process.env.AI_REWRITE_RETENTION_DAYS = "7";

const pdfEntry = formatCapabilityMatrix.find((entry) => entry.id === "pdf");

assert.ok(pdfEntry, "PDF format entry should exist in the capability matrix.");
assert.equal(pdfEntry.capabilities.read.state, "supported");
assert.equal(pdfEntry.capabilities.scan.state, "supported");
assert.equal(pdfEntry.capabilities.edit.state, "limited");
assert.equal(pdfEntry.capabilities.export.state, "limited");
assert.match(
  pdfEntry.capabilities.edit.description,
  /不承诺复杂版式下的精确回写/u,
);

assert.equal(uploadModeLabels.workbench, "工作台模式");
assert.equal(getSupportedUploadFormat("draft.docx")?.label, "Word (.docx)");
assert.equal(getSupportedUploadFormat("scan.pdf")?.boundary.includes("不承诺"), true);

const policyItems = buildDataPolicyItems({
  retentionDays: 7,
  accessScope: sharedAccessScopeCopy,
  trainingUse: "excluded",
});

assert.equal(policyItems.length >= 5, true);
assert.ok(
  policyItems.some((item) => /默认保留 7 天/u.test(item.summary)),
  "Policy items should mention the default seven-day retention period.",
);
assert.ok(
  policyItems.some((item) => /默认不用于模型训练/u.test(item.summary)),
  "Policy items should mention the training exclusion boundary.",
);
assert.ok(
  policyItems.some((item) => /最小范围运营人员/u.test(item.summary)),
  "Policy items should mention the access boundary.",
);

const idleGuidance = getUploadStageGuidance({
  state: "idle",
  retentionDays: 7,
});
assert.match(idleGuidance.title, /上传前先确认/u);
assert.ok(idleGuidance.items.some((item) => /支持 Word、PDF、TXT/u.test(item)));

const errorGuidance = getUploadStageGuidance({
  state: "error",
  retentionDays: 7,
});
assert.ok(
  errorGuidance.items.some((item) => /失败不会改变默认 7 天保留规则/u.test(item)),
);

const taskGuidance = getTaskStageGuidance({
  status: "processing",
  stage: "scan",
  retentionDays: 7,
  nextStep: "保持当前页面开启，等待系统继续推进扫描阶段。",
  failure: null,
});
assert.ok(taskGuidance.items.some((item) => /当前数据已进入受控存储/u.test(item)));
assert.ok(taskGuidance.items.some((item) => /默认保留 7 天/u.test(item)));

const { accessToken, accessTokenHash } = createTaskAccessToken();
const storedContext = createTaskAccessContext({
  sessionId: "session-1",
  taskId: "task-1",
  mode: "workbench",
  accessToken,
});

const taskResult = await readAuthorizedTask({
  taskId: "task-1",
  storedContext,
  repository: {
    async createTaskRecord() {
      throw new Error("not implemented in test");
    },
    async updateTaskRecordState() {
      throw new Error("not implemented in test");
    },
    async findTaskRecordById(taskId) {
      return {
        taskId,
        sessionId: "session-1",
        mode: "workbench",
        status: "processing",
        stage: "scan",
        progressPercent: 45,
        statusMessage: "正在扫描高风险段落。",
        nextStep: "保持页面开启，稍后查看扫描结果。",
        retryable: false,
        failureCode: null,
        failureStage: null,
        failureMessage: null,
        accessTokenHash,
        fileName: "draft.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 2048,
        checksumSha256: "abc",
        bucketName: "local",
        objectKey: "tasks/task-1/draft.docx",
        storageProvider: "memory",
        createdAt: "2026-03-23T12:00:00.000Z",
        updatedAt: "2026-03-23T12:01:00.000Z",
      };
    },
  },
});

assert.ok("data" in taskResult, "Authorized task read should return task data.");
if ("data" in taskResult) {
  assert.equal(taskResult.data.accessScope, sharedAccessScopeCopy);
  assert.equal(taskResult.data.retentionDays, 7);
  assert.equal(taskResult.data.trainingUse, "excluded");
}

console.log("policy tests passed");