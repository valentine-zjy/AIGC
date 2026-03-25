import type {
  TaskApiErrorCode,
  TaskFeedbackAction,
  TaskFeedbackResultData,
} from "@ai-rewrite/contracts";
import {
  getEditOperationRepository,
  getRewriteOptionRepository,
  getRiskFindingRepository,
  getTaskRepository,
  type EditOperationRepository,
  type RewriteOptionRepository,
  type RiskFindingRepository,
  type TaskRepository,
} from "@ai-rewrite/db";

import type { StoredTaskContext } from "../../task-session.ts";
import { readAuthorizedTask } from "../tasks/task-service.ts";
import { isParagraphWorkbenchReady } from "../tasks/task-workbench-stage.ts";

type TaskFeedbackErrorResult = {
  status: number;
  error: TaskApiErrorCode;
  message: string;
  nextStep: string;
};

const feedbackMessages: Record<TaskFeedbackAction, string> = {
  ignore_paragraph:
    "The paragraph was marked as ignored and removed from the pending queue.",
  mark_false_positive:
    "The paragraph was marked as a suspected false positive and removed from the pending queue.",
  mark_disagree:
    "The paragraph was marked as disagree and removed from the pending queue.",
  mark_unhelpful:
    "The paragraph was marked as unhelpful and removed from the pending queue.",
};

export async function applyTaskFeedback({
  taskId,
  paragraphId,
  optionId,
  action,
  storedContext,
  taskRepository = getTaskRepository(),
  rewriteOptionRepository = getRewriteOptionRepository(),
  riskRepository = getRiskFindingRepository(),
  editOperationRepository = getEditOperationRepository(),
}: {
  taskId: string;
  paragraphId: string;
  optionId?: string;
  action: TaskFeedbackAction;
  storedContext: StoredTaskContext | null;
  taskRepository?: TaskRepository;
  rewriteOptionRepository?: RewriteOptionRepository;
  riskRepository?: RiskFindingRepository;
  editOperationRepository?: EditOperationRepository;
}): Promise<
  | { data: TaskFeedbackResultData }
  | Awaited<ReturnType<typeof readAuthorizedTask>>
  | TaskFeedbackErrorResult
> {
  const taskResult = await readAuthorizedTask({
    taskId,
    storedContext,
    repository: taskRepository,
  });

  if (!("data" in taskResult)) {
    return taskResult;
  }

  if (!isParagraphWorkbenchReady(taskResult.data)) {
    return {
      status: 409,
      error: "task_edit_not_allowed",
      message: "The task is not ready for paragraph feedback yet.",
      nextStep:
        "Wait for the paragraph workbench to become ready, then try again.",
    };
  }

  const riskFindings = await riskRepository.listTaskRiskFindings({
    taskId,
    sortBy: "paragraph_asc",
  });
  const currentFinding = riskFindings.find(
    (finding) => finding.paragraphId === paragraphId,
  );

  if (!currentFinding) {
    return {
      status: 404,
      error: "risk_finding_not_found",
      message: "The selected paragraph is no longer available in the current risk list.",
      nextStep: "Refresh the workbench and reopen the paragraph before trying again.",
    };
  }

  if (optionId) {
    const options = await rewriteOptionRepository.listTaskRewriteOptions({
      taskId,
      paragraphId,
    });
    const matchedOption = options.find((option) => option.optionId === optionId);

    if (!matchedOption) {
      return {
        status: 404,
        error: "rewrite_option_not_found",
        message: "The selected rewrite option was not found for this paragraph.",
        nextStep:
          "Refresh the paragraph suggestions and choose a valid option before trying again.",
      };
    }
  }

  const operation = await editOperationRepository.appendTaskEditOperation({
    taskId,
    paragraphId,
    optionId: optionId ?? null,
    operationType: action,
    handlingStatus: "ignored",
    appliedText: null,
  });

  await riskRepository.updateTaskRiskFindingHandlingStatus({
    taskId,
    paragraphId,
    handlingStatus: "ignored",
  });

  const nextPending = await riskRepository.listTaskRiskFindings({
    taskId,
    handlingStatus: "pending",
    sortBy: "recommended",
    limit: 10,
  });
  const nextParagraphId =
    nextPending.find((item) => item.paragraphId !== paragraphId)?.paragraphId ??
    null;

  return {
    data: {
      taskId,
      paragraphId,
      optionId: optionId ?? null,
      action,
      handlingStatus: "ignored",
      nextParagraphId,
      message: feedbackMessages[action],
      operation,
    },
  };
}
