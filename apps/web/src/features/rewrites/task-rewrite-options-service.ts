import type { TaskRewriteOptionData } from "@ai-rewrite/contracts";
import {
  getRewriteOptionRepository,
  getTaskRepository,
  type RewriteOptionRepository,
  type TaskRepository,
} from "@ai-rewrite/db";

import type { StoredTaskContext } from "../../task-session.ts";
import { isPdfMimeType } from "../tasks/task-format-boundary.ts";
import { readAuthorizedTask } from "../tasks/task-service.ts";
import { isParagraphWorkbenchReady } from "../tasks/task-workbench-stage.ts";

export async function readAuthorizedTaskRewriteOptions({
  taskId,
  paragraphId,
  storedContext,
  taskRepository = getTaskRepository(),
  rewriteOptionRepository = getRewriteOptionRepository(),
}: {
  taskId: string;
  paragraphId: string;
  storedContext: StoredTaskContext | null;
  taskRepository?: TaskRepository;
  rewriteOptionRepository?: RewriteOptionRepository;
}): Promise<
  | { data: TaskRewriteOptionData }
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

  if (isPdfMimeType(taskResult.data.mimeType)) {
    return {
      data: {
        taskId,
        paragraphId,
        state: "unavailable",
        message:
          "当前 PDF 任务只支持扫描结果查看；如需查看局部改写建议并继续精修，请改用 Word / TXT。",
        options: [],
      },
    };
  }

  if (!isParagraphWorkbenchReady(taskResult.data)) {
    return {
      data: {
        taskId,
        paragraphId,
        state: "pending",
        message:
          taskResult.data.status === "failed"
            ? "当前任务未成功完成，暂时无法读取当前段落的局部改写建议。"
            : "系统仍在生成当前段落的局部改写建议，请保持页面打开并等待工作台就绪。",
        options: [],
      },
    };
  }

  const options = await rewriteOptionRepository.listTaskRewriteOptions({
    taskId,
    paragraphId,
  });

  if (options.length === 0) {
    return {
      data: {
        taskId,
        paragraphId,
        state: "unavailable",
        message:
          "当前段落的候选局部改写建议暂未就绪，可能仍在补齐，或该段暂时不适合提供局部改写。",
        options: [],
      },
    };
  }

  return {
    data: {
      taskId,
      paragraphId,
      state: "ready",
      message: "当前段落的局部改写建议已经可读。",
      options,
    },
  };
}
