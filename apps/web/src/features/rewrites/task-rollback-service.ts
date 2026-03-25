import type { TaskApiErrorCode, TaskRollbackResultData } from "@ai-rewrite/contracts";
import { getEditOperationRepository, getRiskFindingRepository, getTaskRepository, type EditOperationRepository, type RiskFindingRepository, type TaskRepository } from "@ai-rewrite/db";
import type { StoredTaskContext } from "../../task-session.ts";
import { isPdfMimeType } from "../tasks/task-format-boundary.ts";
import { readAuthorizedTask } from "../tasks/task-service.ts";
import { isParagraphWorkbenchReady } from "../tasks/task-workbench-stage.ts";
type TaskRollbackErrorResult = { status: number; error: TaskApiErrorCode; message: string; nextStep: string };
export async function rollbackTaskEdit({ taskId, paragraphId, storedContext, taskRepository = getTaskRepository(), riskRepository = getRiskFindingRepository(), editOperationRepository = getEditOperationRepository(), }: { taskId: string; paragraphId: string; storedContext: StoredTaskContext | null; taskRepository?: TaskRepository; riskRepository?: RiskFindingRepository; editOperationRepository?: EditOperationRepository; }): Promise<{ data: TaskRollbackResultData } | Awaited<ReturnType<typeof readAuthorizedTask>> | TaskRollbackErrorResult> {
  const taskResult = await readAuthorizedTask({ taskId, storedContext, repository: taskRepository });
  if (!("data" in taskResult)) return taskResult;
  if (isPdfMimeType(taskResult.data.mimeType)) return { status: 409, error: "task_edit_not_allowed", message: "PDF workbench tasks do not support paragraph rollback.", nextStep: "Upload a Word or TXT document if you need editable paragraph rollback." };
  if (!isParagraphWorkbenchReady(taskResult.data)) return { status: 409, error: "task_edit_not_allowed", message: "The task is not ready for rollback yet.", nextStep: "Wait for the paragraph workbench to become ready, then try the rollback action again." };
  const riskFindings = await riskRepository.listTaskRiskFindings({ taskId, sortBy: "paragraph_asc" });
  const currentFinding = riskFindings.find((finding) => finding.paragraphId === paragraphId);
  if (!currentFinding) return { status: 404, error: "risk_finding_not_found", message: "The selected paragraph is no longer available in the current risk list.", nextStep: "Refresh the workbench and reopen the paragraph before trying again." };
  const paragraphOperations = await editOperationRepository.listTaskEditOperations({ taskId, paragraphId });
  const latestOperation = paragraphOperations.at(-1) ?? null;
  if (!latestOperation || latestOperation.operationType !== "accept_suggestion") return { status: 409, error: "rollback_not_available", message: "There is no accepted paragraph rewrite available to roll back.", nextStep: "Accept a paragraph rewrite first, or reopen a paragraph whose latest state is accepted." };
  const operation = await editOperationRepository.appendTaskEditOperation({ taskId, paragraphId, optionId: latestOperation.optionId, operationType: "rollback_edit", handlingStatus: "pending", appliedText: null });
  await riskRepository.updateTaskRiskFindingHandlingStatus({ taskId, paragraphId, handlingStatus: "pending" });
  return { data: { taskId, paragraphId, handlingStatus: "pending", nextParagraphId: paragraphId, message: "The latest accepted rewrite for this paragraph was rolled back. The paragraph is editable again and its suggestions remain available.", operation } };
}
