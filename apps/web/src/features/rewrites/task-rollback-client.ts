"use client";
import { taskErrorEnvelopeSchema, taskRollbackInputSchema, taskRollbackResultEnvelopeSchema, type TaskRollbackResultData } from "@ai-rewrite/contracts";
export class TaskRollbackRequestError extends Error { readonly status: number; readonly code?: string; readonly nextStep?: string; constructor(message: string, status: number, code?: string, nextStep?: string) { super(message); this.status = status; this.code = code; this.nextStep = nextStep; } }
export async function submitTaskRollback({ taskId, paragraphId }: { taskId: string; paragraphId: string }): Promise<TaskRollbackResultData> {
  const payload = taskRollbackInputSchema.parse({ paragraphId });
  const response = await fetch(`/api/tasks/${taskId}/rollback`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  let body = null; try { body = await response.json(); } catch { body = null; }
  if (!response.ok) { const parsedError = taskErrorEnvelopeSchema.safeParse(body); throw new TaskRollbackRequestError(parsedError.success ? parsedError.data.error.message : "Failed to roll back the paragraph rewrite. Refresh and try again.", response.status, parsedError.success ? parsedError.data.error.code : undefined, parsedError.success ? parsedError.data.error.nextStep : undefined); }
  const parsed = taskRollbackResultEnvelopeSchema.safeParse(body);
  if (!parsed.success) throw new TaskRollbackRequestError("The rollback response is invalid. Refresh and try again.", 500);
  return parsed.data.data;
}