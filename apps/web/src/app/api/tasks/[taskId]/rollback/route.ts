import { createErrorEnvelope, createSuccessEnvelope, taskRollbackInputSchema } from "@ai-rewrite/contracts";
import { rollbackTaskEdit } from "../../../../../features/rewrites/task-rollback-service.ts";
import { getCookieValue } from "../../../../../lib/http/cookies.ts";
import { parseStoredTaskContext, TASK_CONTEXT_COOKIE } from "../../../../../task-session.ts";
function getStoredContext(request: Request) { return parseStoredTaskContext(getCookieValue(request.headers.get("cookie"), TASK_CONTEXT_COOKIE)); }
export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params; let body: unknown = null; try { body = await request.json(); } catch { body = null; }
  const parsedInput = taskRollbackInputSchema.safeParse(body);
  if (!parsedInput.success) return Response.json(createErrorEnvelope({ code: "invalid_task_rollback", message: "The rollback request is missing the required paragraph identifier.", nextStep: "Refresh the page, reopen the paragraph, and try the rollback action again." }), { status: 400 });
  const result = await rollbackTaskEdit({ taskId, paragraphId: parsedInput.data.paragraphId, storedContext: getStoredContext(request) });
  if (!("data" in result)) return Response.json(createErrorEnvelope({ code: result.error, message: result.message, nextStep: result.nextStep }), { status: result.status });
  return Response.json(createSuccessEnvelope(result.data), { status: 200 });
}