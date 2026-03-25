import type { TaskDetailData } from "@ai-rewrite/contracts";

import { getTaskStageLabel, getTaskStatusLabel } from "../tasks/task-status-copy.ts";

export type PolicyItem = {
  id: string;
  title: string;
  summary: string;
};

export const sharedAccessScopeCopy =
  "仅当前匿名任务持有者与履行排障职责所需的最小范围运营人员可访问当前任务数据。";

export function getTrainingUseLabel(
  trainingUse: TaskDetailData["trainingUse"],
): string {
  switch (trainingUse) {
    case "excluded":
      return "默认不用于模型训练。";
  }
}

export function buildDataPolicyItems({
  retentionDays,
  accessScope = sharedAccessScopeCopy,
  trainingUse,
}: {
  retentionDays: number;
  accessScope?: string;
  trainingUse: TaskDetailData["trainingUse"];
}): PolicyItem[] {
  return [
    {
      id: "storage",
      title: "存储范围",
      summary:
        "原始文件、处理中间产物与导出结果进入受控私有存储，不长期保留在浏览器本地。",
    },
    {
      id: "access",
      title: "访问边界",
      summary: accessScope,
    },
    {
      id: "retention",
      title: "保留期限",
      summary: `默认保留 ${retentionDays} 天，超过保留期后会自动删除或做不可恢复清理。`,
    },
    {
      id: "training",
      title: "训练使用边界",
      summary: getTrainingUseLabel(trainingUse),
    },
    {
      id: "deletion",
      title: "删除说明",
      summary:
        "你可以在任务页直接发起删除，系统会清理当前文档、任务记录与关联访问上下文。",
    },
  ];
}

export function getUploadStageGuidance({
  state,
  retentionDays,
}: {
  state: "idle" | "submitting" | "accepted" | "error";
  retentionDays: number;
}) {
  switch (state) {
    case "submitting":
      return {
        title: "正在校验文档并建立任务",
        description: "上传页不会静默等待，当前状态与下一步会持续显示在这里。",
        items: [
          "当前阶段会再次校验扩展名、MIME 类型与文件大小。",
          "文档进入受控存储后，后续状态会在任务页持续更新。",
          `默认保留 ${retentionDays} 天，且默认不用于模型训练。`,
        ],
      };
    case "accepted":
      return {
        title: "任务已创建，下一步进入任务页",
        description: "上传成功后会自动跳转到任务页，继续查看扫描与处理状态。",
        items: [
          "Word / TXT 支持读取、扫描、局部精修与导出。",
          "PDF 当前以读取和扫描结果查看为主，不承诺复杂排版精确回写。",
          `当前任务数据默认保留 ${retentionDays} 天。`,
        ],
      };
    case "error":
      return {
        title: "先处理当前错误，再决定是否重试",
        description: "失败并不意味着规则消失，页面会继续说明数据边界与下一步动作。",
        items: [
          "确认文件格式、大小与当前上传上下文是否有效。",
          `失败不会改变默认 ${retentionDays} 天保留规则，也不会改变默认不用于模型训练的边界。`,
          "如需继续，可修正问题后重新上传或重新建立任务上下文。",
        ],
      };
    case "idle":
    default:
      return {
        title: "上传前先确认格式能力与数据规则",
        description: "在开始上传前先确认支持范围、处理边界和保留策略，避免先上传再猜系统能做什么。",
        items: [
          "支持 Word、PDF、TXT，单文件大小上限为 20 MB。",
          "Word / TXT 支持读取、扫描、局部精修与导出；PDF 当前只承诺读取与扫描结果查看。",
          `默认保留 ${retentionDays} 天，且默认不用于模型训练。`,
        ],
      };
  }
}

export function getTaskStageGuidance({
  status,
  stage,
  retentionDays,
  nextStep,
  failure,
}: Pick<TaskDetailData, "status" | "stage" | "retentionDays" | "nextStep" | "failure">) {
  if (status === "failed" && failure) {
    return {
      title: `${getTaskStageLabel(failure.stage)}阶段需要人工处理`,
      description: "系统会说明失败位置、当前数据边界和建议的补救动作。",
      items: [
        "当前数据仍处于受控存储范围内，不会因为失败而失去访问边界说明。",
        `默认保留 ${retentionDays} 天；如需删除，请在任务页直接发起删除。`,
        failure.nextStep,
      ],
    };
  }

  if (status === "completed") {
    return {
      title: "当前扫描编排已完成，可继续查看结果与后续动作",
      description: "任务完成后，页面仍会保留格式边界与数据规则说明，避免结果可见但规则不可见。",
      items: [
        "当前故事已完成上传、解析和扫描状态写回；优化建议与导出结果将在后续故事继续补齐。",
        "Word / TXT 仍是后续精修与导出的优先格式；PDF 仍以读取与扫描结果查看为主。",
        `任务数据默认保留 ${retentionDays} 天，${getTrainingUseLabel("excluded")}`,
      ],
    };
  }

  return {
    title: `${getTaskStageLabel(stage)}阶段正在推进`,
    description: `当前任务状态为${getTaskStatusLabel(status)}，你可以结合下一步说明决定是否继续停留在本页。`,
    items: [
      "当前数据已进入受控存储，任务页会继续显示访问边界、保留策略与训练使用边界。",
      `默认保留 ${retentionDays} 天，删除入口会固定显示在任务页。`,
      nextStep,
    ],
  };
}