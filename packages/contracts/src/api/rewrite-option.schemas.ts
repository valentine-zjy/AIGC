import { z } from "zod";

import { successEnvelopeSchema } from "./envelope.ts";

export const taskRewriteOptionStates = [
  "pending",
  "ready",
  "unavailable",
] as const;

export const taskRewriteOptionStateSchema = z.enum(taskRewriteOptionStates);

export const taskRewriteOptionQuerySchema = z.object({
  paragraphId: z.string().min(1),
});

export const taskRewriteOptionItemSchema = z.object({
  optionId: z.string().min(1),
  taskId: z.string().min(1),
  paragraphId: z.string().min(1),
  optionRank: z.number().int().min(1).max(3),
  title: z.string().min(1),
  strategyLabel: z.string().min(1),
  candidateText: z.string().min(1),
  rationale: z.string().min(1),
  diffSummary: z.string().min(1),
  isRecommended: z.boolean(),
  createdAt: z.string().datetime(),
});

export const taskRewriteOptionDataSchema = z.object({
  taskId: z.string().min(1),
  paragraphId: z.string().min(1),
  state: taskRewriteOptionStateSchema,
  message: z.string().min(1),
  options: z.array(taskRewriteOptionItemSchema),
});

export const taskRewriteOptionEnvelopeSchema = successEnvelopeSchema(
  taskRewriteOptionDataSchema,
);

export type TaskRewriteOptionState = z.infer<
  typeof taskRewriteOptionStateSchema
>;
export type TaskRewriteOptionQuery = z.infer<
  typeof taskRewriteOptionQuerySchema
>;
export type TaskRewriteOptionItem = z.infer<
  typeof taskRewriteOptionItemSchema
>;
export type TaskRewriteOptionData = z.infer<
  typeof taskRewriteOptionDataSchema
>;