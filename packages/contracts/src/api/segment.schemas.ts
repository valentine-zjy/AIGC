import { z } from "zod";

import { successEnvelopeSchema } from "./envelope.ts";

export const taskSegmentStates = ["pending", "ready", "unavailable"] as const;
export const taskSegmentConfidenceBuckets = [
  "high_confidence_issue",
  "optional_optimization",
] as const;
export const taskSegmentContextStatuses = ["full", "limited"] as const;

export const taskSegmentStateSchema = z.enum(taskSegmentStates);
export const taskSegmentConfidenceBucketSchema = z.enum(
  taskSegmentConfidenceBuckets,
);
export const taskSegmentContextStatusSchema = z.enum(
  taskSegmentContextStatuses,
);

export const taskSegmentQuerySchema = z.object({
  paragraphId: z.string().min(1),
});

export const taskSegmentItemSchema = z.object({
  taskId: z.string().min(1),
  paragraphId: z.string().min(1),
  originalText: z.string().min(1),
  previousContext: z.string().min(1).nullable(),
  nextContext: z.string().min(1).nullable(),
  diagnosisReason: z.string().min(1),
  confidenceBucket: taskSegmentConfidenceBucketSchema,
  confidenceLabel: z.string().min(1),
  confidenceSummary: z.string().min(1),
  contextStatus: taskSegmentContextStatusSchema,
  contextStatusLabel: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const taskSegmentDataSchema = z.object({
  taskId: z.string().min(1),
  paragraphId: z.string().min(1),
  state: taskSegmentStateSchema,
  message: z.string().min(1),
  item: taskSegmentItemSchema.nullable(),
});

export const taskSegmentEnvelopeSchema = successEnvelopeSchema(
  taskSegmentDataSchema,
);

export type TaskSegmentState = z.infer<typeof taskSegmentStateSchema>;
export type TaskSegmentConfidenceBucket = z.infer<
  typeof taskSegmentConfidenceBucketSchema
>;
export type TaskSegmentContextStatus = z.infer<
  typeof taskSegmentContextStatusSchema
>;
export type TaskSegmentQuery = z.infer<typeof taskSegmentQuerySchema>;
export type TaskSegmentItem = z.infer<typeof taskSegmentItemSchema>;
export type TaskSegmentData = z.infer<typeof taskSegmentDataSchema>;
