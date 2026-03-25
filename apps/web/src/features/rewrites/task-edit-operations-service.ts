import type {
  TaskApiErrorCode,
  TaskEditDecisionAction,
  TaskEditOperationResultData,
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
import { isPdfMimeType } from "../tasks/task-format-boundary.ts";
import { readAuthorizedTask } from "../tasks/task-service.ts";
import { isParagraphWorkbenchReady } from "../tasks/task-workbench-stage.ts";

type TaskEditOperationErrorResult = {
  status: number;
  error: TaskApiErrorCode;
  message: string;
  nextStep: string;
};

export async function applyTaskEditOperationDecision({
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
  optionId: string;
  action: TaskEditDecisionAction;
  storedContext: StoredTaskContext | null;
  taskRepository?: TaskRepository;
  rewriteOptionRepository?: RewriteOptionRepository;
  riskRepository?: RiskFindingRepository;
  editOperationRepository?: EditOperationRepository;
}): Promise<
  | { data: TaskEditOperationResultData }
  | Awaited<ReturnType<typeof readAuthorizedTask>>
  | TaskEditOperationErrorResult
> {
  const taskResult = await readAuthorizedTask({
    taskId,
    storedContext,
    repository: taskRepository,
  });

  if (!("data" in taskResult)) {
    return taskResult;
  }

  if (isPdfMimeType(taskResult.data.mimeType)) {
    return {
      status: 409,
      error: "task_edit_not_allowed",
      message:
        "This PDF task is read-only. Local accept or reject decisions are not available for PDF workbench tasks.",
      nextStep:
        "Upload a Word or TXT document if you need editable paragraph-level decisions.",
    };
  }

  if (!isParagraphWorkbenchReady(taskResult.data)) {
    return {
      status: 409,
      error: "task_edit_not_allowed",
      message:
        "The task is not ready for paragraph-level decisions yet.",
      nextStep:
        "Wait for the paragraph workbench to become ready, then try again.",
    };
  }

  const options = await rewriteOptionRepository.listTaskRewriteOptions({
    taskId,
    paragraphId,
  });
  const matchedOption = options.find((option) => option.optionId === optionId);

  if (!matchedOption) {
    return {
      status: 404,
      error: "rewrite_option_not_found",
      message:
        "The selected rewrite option was not found for this paragraph.",
      nextStep:
        "Refresh the paragraph suggestions and choose a valid option before trying again.",
    };
  }

  const handlingStatus = action === "accept" ? "accepted" : "rejected";
  const operationType =
    action === "accept" ? "accept_suggestion" : "reject_suggestion";
  const operation = await editOperationRepository.appendTaskEditOperation({
    taskId,
    paragraphId,
    optionId,
    operationType,
    handlingStatus,
    appliedText: action === "accept" ? matchedOption.candidateText : null,
  });

  await riskRepository.updateTaskRiskFindingHandlingStatus({
    taskId,
    paragraphId,
    handlingStatus,
  });

  const nextPending = await riskRepository.listTaskRiskFindings({
    taskId,
    handlingStatus: "pending",
    sortBy: "recommended",
    limit: 10,
  });

  return {
    data: {
      taskId,
      paragraphId,
      optionId,
      action,
      handlingStatus,
      nextParagraphId: nextPending[0]?.paragraphId ?? null,
      message:
        action === "accept"
          ? "The selected rewrite was applied to the current paragraph and marked as accepted."
          : "The current rewrite option was rejected and the paragraph remains unchanged.",
      operation,
    },
  };
}
