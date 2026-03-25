import type { TaskDetailData } from "@ai-rewrite/contracts";

export function isParagraphWorkbenchReady(
  task: Pick<TaskDetailData, "status" | "stage">,
) {
  return (
    task.status === "completed" &&
    (task.stage === "scan" || task.stage === "rewrite")
  );
}
