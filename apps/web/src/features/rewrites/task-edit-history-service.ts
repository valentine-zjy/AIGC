import type {
  TaskEditHistoryEmptyState,
  TaskEditOperationCounts,
  TaskEditOperationHistoryData,
  TaskProcessedParagraphSummary,
} from "@ai-rewrite/contracts";
import {
  getEditOperationRepository,
  getRiskFindingRepository,
  getTaskRepository,
  type EditOperationRepository,
  type RiskFindingRepository,
  type TaskRepository,
} from "@ai-rewrite/db";

import type { StoredTaskContext } from "../../task-session.ts";
import { readAuthorizedTask } from "../tasks/task-service.ts";
import { isParagraphWorkbenchReady } from "../tasks/task-workbench-stage.ts";

function createEmptyCounts(): TaskEditOperationCounts {
  return {
    pending: 0,
    accepted: 0,
    rejected: 0,
    ignored: 0,
  };
}

function buildEmptyState(input: {
  isTaskReady: boolean;
  processedCount: number;
}): TaskEditHistoryEmptyState | null {
  if (!input.isTaskReady) {
    return {
      title: "History is not ready yet",
      description:
        "The scan is still running. Status summaries and decision history will appear after results are ready.",
      nextStep:
        "Keep this page open until the scan finishes, then start reviewing paragraphs.",
    };
  }

  if (input.processedCount === 0) {
    return {
      title: "No decisions recorded yet",
      description:
        "Accepted, rejected, or ignored paragraphs will appear here after you act on a paragraph.",
      nextStep:
        "Open a high-risk paragraph and accept or reject a suggestion to start building history.",
    };
  }

  return null;
}

function sortProcessedParagraphs(
  items: TaskProcessedParagraphSummary[],
): TaskProcessedParagraphSummary[] {
  return [...items].sort((left, right) => {
    if (left.lastOperationAt && right.lastOperationAt) {
      const byTime = right.lastOperationAt.localeCompare(
        left.lastOperationAt,
        "zh-CN",
      );

      if (byTime !== 0) {
        return byTime;
      }
    } else if (left.lastOperationAt) {
      return -1;
    } else if (right.lastOperationAt) {
      return 1;
    }

    return left.paragraphId.localeCompare(right.paragraphId, "zh-CN");
  });
}

export async function readAuthorizedTaskEditHistory({
  taskId,
  paragraphId,
  storedContext,
  taskRepository = getTaskRepository(),
  riskRepository = getRiskFindingRepository(),
  editOperationRepository = getEditOperationRepository(),
}: {
  taskId: string;
  paragraphId?: string;
  storedContext: StoredTaskContext | null;
  taskRepository?: TaskRepository;
  riskRepository?: RiskFindingRepository;
  editOperationRepository?: EditOperationRepository;
}): Promise<
  | { data: TaskEditOperationHistoryData }
  | Awaited<ReturnType<typeof readAuthorizedTask>>
> {
  const taskResult = await readAuthorizedTask({
    taskId,
    storedContext,
    repository: taskRepository,
  });

  if (!("data" in taskResult)) {
    return taskResult;
  }

  const isTaskReady = isParagraphWorkbenchReady(taskResult.data);

  if (!isTaskReady) {
    return {
      data: {
        taskId,
        selectedParagraphId: paragraphId ?? null,
        counts: createEmptyCounts(),
        processedParagraphs: [],
        selectedParagraphHistory: [],
        message:
          "History and status summaries will appear after the paragraph workbench is ready and decisions are recorded.",
        emptyState: buildEmptyState({
          isTaskReady,
          processedCount: 0,
        }),
      },
    };
  }

  const [riskFindings, editOperations, selectedParagraphHistory] =
    await Promise.all([
      riskRepository.listTaskRiskFindings({
        taskId,
        sortBy: "paragraph_asc",
      }),
      editOperationRepository.listTaskEditOperations({ taskId }),
      paragraphId
        ? editOperationRepository.listTaskEditOperations({
            taskId,
            paragraphId,
          })
        : Promise.resolve([]),
    ]);

  const counts = createEmptyCounts();

  for (const finding of riskFindings) {
    counts[finding.handlingStatus] += 1;
  }

  const latestOperationByParagraph = new Map(
    editOperations.map((operation) => [operation.paragraphId, operation]),
  );

  const processedParagraphs = sortProcessedParagraphs(
    riskFindings
      .filter((finding) => finding.handlingStatus !== "pending")
      .map((finding) => {
        const latestOperation =
          latestOperationByParagraph.get(finding.paragraphId) ?? null;

        return {
          paragraphId: finding.paragraphId,
          latestHandlingStatus: finding.handlingStatus,
          lastOperationAt: latestOperation?.createdAt ?? null,
          lastOperationType: latestOperation?.operationType ?? null,
        };
      }),
  );

  return {
    data: {
      taskId,
      selectedParagraphId: paragraphId ?? null,
      counts,
      processedParagraphs,
      selectedParagraphHistory,
      message:
        processedParagraphs.length > 0
          ? "History and status summary are ready."
          : "No paragraph decisions have been recorded yet.",
      emptyState: buildEmptyState({
        isTaskReady,
        processedCount: processedParagraphs.length,
      }),
    },
  };
}
