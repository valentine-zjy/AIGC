import { z } from "zod";

import { successEnvelopeSchema } from "./envelope.ts";

export const taskRiskStates = ["pending", "ready"] as const;
export const taskRiskLevels = ["high", "medium", "low"] as const;
export const taskRiskHandlingStatuses = [
  "pending",
  "accepted",
  "rejected",
  "ignored",
] as const;
export const taskRiskIssueTypes = [
  "background_template",
  "method_boilerplate",
  "result_formula",
  "conclusion_template",
] as const;
export const taskRiskSortModes = [
  "recommended",
  "score_desc",
  "paragraph_asc",
] as const;

export const taskRiskStateSchema = z.enum(taskRiskStates);
export const taskRiskLevelSchema = z.enum(taskRiskLevels);
export const taskRiskHandlingStatusSchema = z.enum(taskRiskHandlingStatuses);
export const taskRiskIssueTypeSchema = z.enum(taskRiskIssueTypes);
export const taskRiskSortModeSchema = z.enum(taskRiskSortModes);
export const taskRiskFilterLevelSchema = z.enum(["all", ...taskRiskLevels]);
export const taskRiskFilterStatusSchema = z.enum([
  "all",
  ...taskRiskHandlingStatuses,
]);
export const taskRiskFilterIssueTypeSchema = z.enum([
  "all",
  ...taskRiskIssueTypes,
]);

export const taskRiskQuerySchema = z.object({
  riskLevel: taskRiskFilterLevelSchema.optional().default("all"),
  status: taskRiskFilterStatusSchema.optional().default("all"),
  issueType: taskRiskFilterIssueTypeSchema.optional().default("all"),
  sortBy: taskRiskSortModeSchema.optional().default("recommended"),
  limit: z.coerce.number().int().positive().max(10).optional().default(10),
});

export const taskRiskItemSchema = z.object({
  findingId: z.string().min(1),
  taskId: z.string().min(1),
  paragraphId: z.string().min(1),
  riskLevel: taskRiskLevelSchema,
  issueType: taskRiskIssueTypeSchema,
  issueTypeLabel: z.string().min(1),
  issueTypeSummary: z.string().min(1),
  excerpt: z.string().min(1),
  score: z.number().int().nonnegative(),
  handlingStatus: taskRiskHandlingStatusSchema,
  createdAt: z.string().datetime(),
});

export const taskRiskListDataSchema = z.object({
  taskId: z.string().min(1),
  state: taskRiskStateSchema,
  message: z.string().min(1),
  generatedAt: z.string().datetime().nullable(),
  totalCount: z.number().int().nonnegative(),
  filters: z.object({
    riskLevel: taskRiskFilterLevelSchema,
    status: taskRiskFilterStatusSchema,
    issueType: taskRiskFilterIssueTypeSchema,
    sortBy: taskRiskSortModeSchema,
    limit: z.number().int().positive().max(10),
  }),
  items: z.array(taskRiskItemSchema),
});

export const taskRiskListEnvelopeSchema = successEnvelopeSchema(
  taskRiskListDataSchema,
);

export type TaskRiskState = z.infer<typeof taskRiskStateSchema>;
export type TaskRiskLevel = z.infer<typeof taskRiskLevelSchema>;
export type TaskRiskHandlingStatus = z.infer<
  typeof taskRiskHandlingStatusSchema
>;
export type TaskRiskIssueType = z.infer<typeof taskRiskIssueTypeSchema>;
export type TaskRiskSortMode = z.infer<typeof taskRiskSortModeSchema>;
export type TaskRiskFilterLevel = z.infer<typeof taskRiskFilterLevelSchema>;
export type TaskRiskFilterStatus = z.infer<typeof taskRiskFilterStatusSchema>;
export type TaskRiskFilterIssueType = z.infer<
  typeof taskRiskFilterIssueTypeSchema
>;
export type TaskRiskQuery = z.infer<typeof taskRiskQuerySchema>;
export type TaskRiskItem = z.infer<typeof taskRiskItemSchema>;
export type TaskRiskListData = z.infer<typeof taskRiskListDataSchema>;