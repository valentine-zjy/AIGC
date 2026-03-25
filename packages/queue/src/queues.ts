import { processingModeSchema } from "@ai-rewrite/contracts";
import { z } from "zod";

export const DEFAULT_TASK_QUEUE_NAME = "document-processing";
export const TASK_QUEUE_JOB_NAME = "ingest-document";

export const taskJobPayloadSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().min(1),
  mode: processingModeSchema,
  requestedAt: z.string().datetime(),
});

export type TaskJobPayload = z.infer<typeof taskJobPayloadSchema>;
