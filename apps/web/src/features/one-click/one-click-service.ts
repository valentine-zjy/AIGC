import type { OneClickAction, OneClickData, OneClickPreview } from "@ai-rewrite/contracts";
import {
  getDocumentSegmentRepository,
  getRewriteOptionRepository,
  getRiskFindingRepository,
  getTaskRepository,
  type DocumentSegmentRepository,
  type RewriteOptionRepository,
  type RiskFindingRepository,
  type TaskRepository,
} from "@ai-rewrite/db";

import type { StoredTaskContext } from "../../task-session.ts";
import { readAuthorizedTask } from "../tasks/task-service.ts";
import { isPdfMimeType } from "../tasks/task-format-boundary.ts";
import {
  createOneClickSessionEvent,
  readOneClickSession,
  writeOneClickSession,
  type OneClickSessionRecord,
} from "./one-click-session-repository.ts";

const READY_DELAY_MS = 25;

function getGuardrails() {
  return [
    "This preview only uses recommended paragraph rewrites.",
    "You can continue into paragraph-level refinement instead of exporting immediately.",
    "You can roll back the batch preview and return to the pre-preview review state.",
  ];
}

async function buildPreview(
  taskId: string,
  riskRepository: RiskFindingRepository,
  rewriteOptionRepository: RewriteOptionRepository,
  segmentRepository: DocumentSegmentRepository,
): Promise<OneClickPreview> {
  const risks = await riskRepository.listTaskRiskFindings({
    taskId,
    handlingStatus: "pending",
    sortBy: "recommended",
    limit: Number.MAX_SAFE_INTEGER,
  });
  const items = [];

  for (const risk of risks) {
    const options = await rewriteOptionRepository.listTaskRewriteOptions({
      taskId,
      paragraphId: risk.paragraphId,
    });
    const option = options.find((item) => item.isRecommended) ?? options[0] ?? null;
    const segment = await segmentRepository.findTaskDocumentSegment({
      taskId,
      paragraphId: risk.paragraphId,
    });

    if (!option || !segment) {
      continue;
    }

    items.push({
      paragraphId: risk.paragraphId,
      issueTypeLabel: risk.issueTypeLabel,
      strategyLabel: option.strategyLabel,
      beforeText: segment.originalText,
      afterText: option.candidateText,
    });
  }

  return {
    optimizedCount: items.length,
    remainingCount: Math.max(risks.length - items.length, 0),
    changeSummary:
      items.length > 0
        ? `Prepared a guarded preview for ${items.length} high-risk paragraphs using their recommended rewrite options.`
        : "No eligible paragraphs were available for one-click optimization.",
    items: items.slice(0, 5),
  };
}

function buildState(input: {
  taskId: string;
  preview: OneClickPreview;
  state: "review" | "processing" | "ready";
  blockedReason: string | null;
  message: string;
  startedAt: string | null;
  completedAt: string | null;
  rolledBackAt: string | null;
}): OneClickData {
  return {
    taskId: input.taskId,
    state: input.state,
    eligible: input.blockedReason === null && input.preview.optimizedCount > 0,
    blockedReason: input.blockedReason,
    message: input.message,
    scopeSummary:
      input.preview.optimizedCount > 0
        ? `${input.preview.optimizedCount} pending paragraphs are eligible for one-click preview.`
        : "No pending paragraph currently meets the one-click preview conditions.",
    guardrails: getGuardrails(),
    canStart:
      input.state === "review" &&
      input.blockedReason === null &&
      input.preview.optimizedCount > 0,
    canRollback: input.state === "ready",
    canContinueRefine: input.state === "ready",
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    rolledBackAt: input.rolledBackAt,
    preview: input.state === "ready" ? input.preview : null,
    nextStep:
      input.state === "ready"
        ? "Review the preview, continue refining, or roll back the batch preview."
        : input.blockedReason ?? "Start the guarded preview when you are ready.",
  };
}

async function resolveBlockedReason({
  mode,
  mimeType,
  status,
  stage,
  preview,
}: {
  mode: "workbench" | "one-click";
  mimeType: string;
  status: string;
  stage: string;
  preview: OneClickPreview;
}) {
  if (mode !== "one-click") {
    return "This task was created in workbench mode, so one-click preview is unavailable.";
  }

  if (isPdfMimeType(mimeType)) {
    return "PDF tasks can be reviewed, but one-click preview is only available for editable Word or TXT uploads.";
  }

  if (status !== "completed" || (stage !== "scan" && stage !== "rewrite")) {
    return "Wait for the scan stage to finish before starting one-click preview.";
  }

  if (preview.optimizedCount === 0) {
    return "No pending paragraph currently has a usable recommended rewrite option for one-click preview.";
  }

  return null;
}

async function resolveSession(
  taskId: string,
  taskRepository: TaskRepository,
): Promise<OneClickSessionRecord | null> {
  const session = await readOneClickSession(taskId);

  if (!session || session.state !== "processing") {
    return session;
  }

  if (Date.now() - Date.parse(session.startedAt) < READY_DELAY_MS) {
    return session;
  }

  const nextSession: OneClickSessionRecord = {
    ...session,
    state: "ready",
    completedAt: new Date().toISOString(),
    events: [
      ...session.events,
      createOneClickSessionEvent({
        eventType: "preview_ready",
        createdAt: new Date().toISOString(),
        state: "ready",
        message: "One-click preview finished and is ready for review.",
      }),
    ],
  };
  await writeOneClickSession(nextSession);
  await taskRepository.updateTaskRecordState({
    taskId,
    status: "completed",
    stage: "rewrite",
    progressPercent: 100,
    statusMessage: "One-click preview is ready.",
    nextStep: "Review the preview, continue refining, or roll back the batch preview.",
    retryable: false,
  });

  return nextSession;
}

export async function readAuthorizedOneClickState({
  taskId,
  storedContext,
  taskRepository = getTaskRepository(),
  riskRepository = getRiskFindingRepository(),
  rewriteOptionRepository = getRewriteOptionRepository(),
  segmentRepository = getDocumentSegmentRepository(),
}: {
  taskId: string;
  storedContext: StoredTaskContext | null;
  taskRepository?: TaskRepository;
  riskRepository?: RiskFindingRepository;
  rewriteOptionRepository?: RewriteOptionRepository;
  segmentRepository?: DocumentSegmentRepository;
}): Promise<
  | { data: OneClickData }
  | Awaited<ReturnType<typeof readAuthorizedTask>>
> {
  const taskResult = await readAuthorizedTask({
    taskId,
    storedContext,
    repository: taskRepository,
  });

  if (!("data" in taskResult) || !("accessScope" in taskResult.data)) {
    return taskResult;
  }

  const preview = await buildPreview(
    taskId,
    riskRepository,
    rewriteOptionRepository,
    segmentRepository,
  );
  const blockedReason = await resolveBlockedReason({
    mode: taskResult.data.mode,
    mimeType: taskResult.data.mimeType,
    status: taskResult.data.status,
    stage: taskResult.data.stage,
    preview,
  });
  const session = await resolveSession(taskId, taskRepository);

  if (session?.state === "processing") {
    return {
      data: buildState({
        taskId,
        preview: session.preview ?? preview,
        state: "processing",
        blockedReason,
        message: "One-click preview is generating in the background.",
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        rolledBackAt: session.rolledBackAt,
      }),
    };
  }

  if (session?.state === "ready") {
    return {
      data: buildState({
        taskId,
        preview: session.preview ?? preview,
        state: "ready",
        blockedReason,
        message: "One-click preview is ready for review.",
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        rolledBackAt: session.rolledBackAt,
      }),
    };
  }

  if (session?.state === "rolled_back") {
    return {
      data: buildState({
        taskId,
        preview,
        state: "review",
        blockedReason,
        message:
          "The one-click preview was rolled back. You are back in the pre-preview review state.",
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        rolledBackAt: session.rolledBackAt,
      }),
    };
  }

  return {
    data: buildState({
      taskId,
      preview,
      state: "review",
      blockedReason,
      message: blockedReason
        ? "One-click preview is currently unavailable for this task."
        : "Review the scope and guardrails before starting one-click preview.",
      startedAt: null,
      completedAt: null,
      rolledBackAt: null,
    }),
  };
}

export async function applyAuthorizedOneClickAction({
  taskId,
  action,
  storedContext,
  taskRepository = getTaskRepository(),
  riskRepository = getRiskFindingRepository(),
  rewriteOptionRepository = getRewriteOptionRepository(),
  segmentRepository = getDocumentSegmentRepository(),
}: {
  taskId: string;
  action: OneClickAction;
  storedContext: StoredTaskContext | null;
  taskRepository?: TaskRepository;
  riskRepository?: RiskFindingRepository;
  rewriteOptionRepository?: RewriteOptionRepository;
  segmentRepository?: DocumentSegmentRepository;
}): Promise<
  | { data: OneClickData }
  | Awaited<ReturnType<typeof readAuthorizedTask>>
  | {
      status: number;
      error: "task_edit_not_allowed" | "invalid_task_rollback";
      message: string;
      nextStep: string;
    }
> {
  const stateResult = await readAuthorizedOneClickState({
    taskId,
    storedContext,
    taskRepository,
    riskRepository,
    rewriteOptionRepository,
    segmentRepository,
  });

  if (!("data" in stateResult) || !("canStart" in stateResult.data)) {
    return stateResult;
  }

  if (action === "start") {
    if (!stateResult.data.canStart) {
      return {
        status: 409,
        error: "task_edit_not_allowed",
        message:
          stateResult.data.blockedReason ?? "One-click preview is not available.",
        nextStep: stateResult.data.nextStep,
      };
    }

    const preview = await buildPreview(
      taskId,
      riskRepository,
      rewriteOptionRepository,
      segmentRepository,
    );
    const startedAt = new Date().toISOString();

    await writeOneClickSession({
      taskId,
      state: "processing",
      startedAt,
      completedAt: null,
      rolledBackAt: null,
      preview,
      events: [
        createOneClickSessionEvent({
          eventType: "start_preview",
          createdAt: startedAt,
          state: "processing",
          message: "Started generating the one-click preview.",
        }),
      ],
    });
    await taskRepository.updateTaskRecordState({
      taskId,
      status: "processing",
      stage: "rewrite",
      progressPercent: 65,
      statusMessage: "Preparing one-click preview.",
      nextStep: "Keep this page open while the guarded preview is generated.",
      retryable: false,
    });

    return {
      data: buildState({
        taskId,
        preview,
        state: "processing",
        blockedReason: null,
        message: "One-click preview is generating in the background.",
        startedAt,
        completedAt: null,
        rolledBackAt: null,
      }),
    };
  }

  const session = await readOneClickSession(taskId);

  if (!session || session.state !== "ready") {
    return {
      status: 409,
      error: "invalid_task_rollback",
      message: "There is no ready one-click preview to roll back.",
      nextStep:
        "Start or reopen a ready one-click preview before attempting rollback.",
    };
  }

  const rolledBackAt = new Date().toISOString();
  await writeOneClickSession({
    ...session,
    state: "rolled_back",
    rolledBackAt,
    events: [
      ...session.events,
      createOneClickSessionEvent({
        eventType: "rollback_preview",
        createdAt: rolledBackAt,
        state: "rolled_back",
        message:
          "Rolled back the one-click preview and returned to the pre-preview review state.",
      }),
    ],
  });
  await taskRepository.updateTaskRecordState({
    taskId,
    status: "completed",
    stage: "scan",
    progressPercent: 100,
    statusMessage: "Returned to pre-preview review state.",
    nextStep:
      "You can start one-click preview again or continue refining paragraph by paragraph.",
    retryable: false,
  });

  return {
    data: buildState({
      taskId,
      preview: session.preview ?? (await buildPreview(taskId, riskRepository, rewriteOptionRepository, segmentRepository)),
      state: "review",
      blockedReason: null,
      message:
        "The one-click preview was rolled back. You can continue with paragraph-level refinement.",
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      rolledBackAt,
    }),
  };
}
