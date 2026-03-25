import assert from "node:assert/strict";

import { buildTaskStatusViewModel } from "./task-status-copy.ts";

function createTask(overrides = {}) {
  return {
    taskId: "task-status-copy-test",
    mode: "workbench",
    status: "queued",
    stage: "upload",
    progressPercent: 12,
    statusMessage: "文档已上传，正在等待处理队列接手。",
    nextStep: "保持当前页面打开，系统会自动刷新任务阶段。",
    retryable: false,
    isDelayed: false,
    failure: null,
    poll: {
      shouldPoll: true,
      intervalMs: 2500,
    },
    fileName: "draft.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: 1024,
    createdAt: "2026-03-23T12:00:00.000Z",
    updatedAt: "2026-03-23T12:00:00.000Z",
    accessScope: "仅当前匿名任务持有者和最小必要范围内的运营人员可访问。",
    retentionDays: 7,
    trainingUse: "excluded",
    ...overrides,
  };
}

const queuedView = buildTaskStatusViewModel(createTask());
assert.equal(queuedView.statusLabel, "排队中");
assert.equal(queuedView.headline, "任务已受理，正在等待队列调度");
assert.equal(queuedView.stages[0]?.state, "current");
assert.equal(queuedView.stages[1]?.state, "upcoming");

const delayedQueuedView = buildTaskStatusViewModel(
  createTask({
    isDelayed: true,
  }),
);
assert.equal(delayedQueuedView.headline, "任务排队时间比平时更长");
assert.match(delayedQueuedView.helper, /队列中等待执行/u);

const processingView = buildTaskStatusViewModel(
  createTask({
    status: "processing",
    stage: "scan",
    progressPercent: 78,
    statusMessage: "正在扫描高风险段落与表达问题。",
    nextStep: "扫描完成后会先收口本故事范围；优化建议与导出结果将在后续故事继续实现。",
  }),
);
assert.equal(processingView.statusLabel, "处理中");
assert.equal(processingView.headline, "扫描阶段正在推进");
assert.equal(processingView.stages[1]?.state, "completed");
assert.equal(processingView.stages[2]?.state, "current");

const delayedProcessingView = buildTaskStatusViewModel(
  createTask({
    status: "processing",
    stage: "scan",
    progressPercent: 78,
    isDelayed: true,
    statusMessage: "正在扫描高风险段落与表达问题。",
  }),
);
assert.equal(delayedProcessingView.headline, "扫描阶段处理时间比平时更长");
assert.match(delayedProcessingView.helper, /Worker 仍在处理当前阶段/u);

const failedView = buildTaskStatusViewModel(
  createTask({
    status: "failed",
    stage: "scan",
    progressPercent: 78,
    retryable: true,
    failure: {
      taskId: "task-status-copy-test",
      code: "scan_failed",
      stage: "scan",
      message: "处理在扫描阶段失败，当前文档仍安全保留，但尚未生成可继续使用的扫描结果。",
      retryable: true,
      nextStep: "当前文档仍按默认保留期保存。请稍后重新上传同一份文档；如果反复失败，请联系支持并提供任务编号。",
    },
  }),
);
assert.equal(failedView.statusLabel, "已失败");
assert.equal(failedView.headline, "扫描阶段处理失败");
assert.equal(failedView.helper, "处理在扫描阶段失败，当前文档仍安全保留，但尚未生成可继续使用的扫描结果。");
assert.equal(failedView.stages[2]?.state, "failed");
assert.equal(failedView.nextStep, "当前文档仍按默认保留期保存。请稍后重新上传同一份文档；如果反复失败，请联系支持并提供任务编号。");

const completedView = buildTaskStatusViewModel(
  createTask({
    status: "completed",
    stage: "scan",
    progressPercent: 100,
    statusMessage: "上传、解析和扫描阶段已完成，首轮 Top 风险结果已经可读。",
    nextStep: "你现在可以查看首轮 Top 风险列表；原因解释、改写建议与导出能力会在后续故事继续补齐。",
    poll: {
      shouldPoll: false,
      intervalMs: 2500,
    },
  }),
);
assert.equal(completedView.statusLabel, "已完成");
assert.equal(completedView.headline, "扫描与首轮风险结果已完成");
assert.match(completedView.helper, /后续故事/u);
assert.equal(completedView.stages[2]?.state, "completed");
assert.equal(completedView.stages[3]?.state, "upcoming");
assert.match(completedView.stages[3]?.ariaLabel ?? "", /当前仅保留轨道占位/u);

console.log("task status copy tests passed");