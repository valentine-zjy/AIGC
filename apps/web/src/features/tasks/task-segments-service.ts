import type { TaskSegmentData } from "@ai-rewrite/contracts";
import {
  getDocumentSegmentRepository,
  getTaskRepository,
  type DocumentSegmentRepository,
  type TaskRepository,
} from "@ai-rewrite/db";

import type { StoredTaskContext } from "../../task-session.ts";
import { readAuthorizedTask } from "./task-service.ts";
import { isParagraphWorkbenchReady } from "./task-workbench-stage.ts";

export async function readAuthorizedTaskSegment({
  taskId,
  paragraphId,
  storedContext,
  taskRepository = getTaskRepository(),
  segmentRepository = getDocumentSegmentRepository(),
}: {
  taskId: string;
  paragraphId: string;
  storedContext: StoredTaskContext | null;
  taskRepository?: TaskRepository;
  segmentRepository?: DocumentSegmentRepository;
}): Promise<
  | { data: TaskSegmentData }
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

  if (!isParagraphWorkbenchReady(taskResult.data)) {
    return {
      data: {
        taskId,
        paragraphId,
        state: "pending",
        message:
          taskResult.data.status === "failed"
            ? "扫描尚未成功完成，暂时无法读取当前段落的诊断信息。"
            : "系统仍在生成当前段落的诊断面板数据，请保持页面打开并等待工作台就绪。",
        item: null,
      },
    };
  }

  const item = await segmentRepository.findTaskDocumentSegment({
    taskId,
    paragraphId,
  });

  if (!item) {
    return {
      data: {
        taskId,
        paragraphId,
        state: "unavailable",
        message:
          "当前段落的诊断信息暂未就绪，可能是上下文受限或该段结果尚未补齐。",
        item: null,
      },
    };
  }

  return {
    data: {
      taskId,
      paragraphId,
      state: "ready",
      message: "当前段落的原文上下文、判定原因与置信提示已经可读。",
      item,
    },
  };
}
