import type { TaskDetailData, TaskStage, TaskStatus } from "@ai-rewrite/contracts";

export const taskRailStages: ReadonlyArray<{
  key: TaskStage;
  label: string;
  description: string;
}> = [
  {
    key: "upload",
    label: "上传",
    description: "文档已完成受理并写入受控存储，任务正在等待后续处理。",
  },
  {
    key: "parse",
    label: "解析",
    description: "正在抽取文档结构，为扫描阶段准备输入。",
  },
  {
    key: "scan",
    label: "扫描",
    description: "正在扫描高风险段落与表达问题，并写回任务状态。",
  },
  {
    key: "rewrite",
    label: "优化建议",
    description: "该阶段将在后续故事中落地，当前仅保留轨道占位，不代表能力已开放。",
  },
  {
    key: "export",
    label: "导出结果",
    description: "该阶段将在后续故事中落地，当前仅保留轨道占位，不代表导出已可用。",
  },
] as const;

export type TaskRailStageState =
  | "completed"
  | "current"
  | "upcoming"
  | "failed";

export function getTaskStageLabel(stage: TaskStage) {
  return taskRailStages.find((item) => item.key === stage)?.label ?? stage;
}

export function getTaskStatusLabel(status: TaskStatus) {
  switch (status) {
    case "queued":
      return "排队中";
    case "processing":
      return "处理中";
    case "failed":
      return "已失败";
    case "completed":
      return "已完成";
  }
}

function getStageState(task: TaskDetailData, stage: TaskStage): TaskRailStageState {
  const activeIndex = taskRailStages.findIndex((item) => item.key === task.stage);
  const stageIndex = taskRailStages.findIndex((item) => item.key === stage);

  if (task.status === "failed" && task.stage === stage) {
    return "failed";
  }

  if (task.status === "completed") {
    return stageIndex <= activeIndex ? "completed" : "upcoming";
  }

  if (stageIndex < activeIndex) {
    return "completed";
  }

  if (stage === task.stage) {
    return "current";
  }

  return "upcoming";
}

function getStageStateText(state: TaskRailStageState) {
  switch (state) {
    case "completed":
      return "已完成";
    case "current":
      return "进行中";
    case "failed":
      return "失败";
    case "upcoming":
      return "待开始";
  }
}

function buildHeadline(task: TaskDetailData) {
  if (task.status === "failed") {
    return `${getTaskStageLabel(task.stage)}阶段处理失败`;
  }

  if (task.status === "completed") {
    return task.stage === "scan"
      ? "扫描与首轮风险结果已完成"
      : `${getTaskStageLabel(task.stage)}阶段已完成`;
  }

  if (task.isDelayed) {
    return task.status === "queued"
      ? "任务排队时间比平时更长"
      : `${getTaskStageLabel(task.stage)}阶段处理时间比平时更长`;
  }

  if (task.status === "queued") {
    return "任务已受理，正在等待队列调度";
  }

  return `${getTaskStageLabel(task.stage)}阶段正在推进`;
}

function buildHelper(task: TaskDetailData) {
  if (task.status === "failed") {
    return task.failure?.message ?? task.statusMessage;
  }

  if (task.status === "completed" && task.stage === "scan") {
    return "当前故事已完成上传、解析、扫描以及首轮 Top 风险结果发布。原因解释、改写建议与导出结果会在后续故事中继续补齐。";
  }

  if (task.isDelayed) {
    return task.status === "queued"
      ? "任务仍在队列中等待执行，系统会继续保留受理状态并自动刷新。"
      : "Worker 仍在处理当前阶段。你可以保留当前页面开启，系统会继续通过短轮询刷新状态。";
  }

  return task.statusMessage;
}

export function buildTaskStatusViewModel(task: TaskDetailData) {
  return {
    headline: buildHeadline(task),
    helper: buildHelper(task),
    statusLabel: getTaskStatusLabel(task.status),
    nextStep: task.failure?.nextStep ?? task.nextStep,
    stages: taskRailStages.map((stage) => {
      const state = getStageState(task, stage.key);
      const stateText = getStageStateText(state);

      return {
        ...stage,
        state,
        stateText,
        ariaLabel: `${stage.label}，${stateText}。${stage.description}`,
      };
    }),
  };
}