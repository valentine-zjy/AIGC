import { text, timestamp, pgTable } from "drizzle-orm/pg-core";

import type {
  TaskEditOperationType,
  TaskRiskHandlingStatus,
} from "@ai-rewrite/contracts";

import { processingTasks } from "./processing-tasks.ts";

export const editOperations = pgTable("edit_operations", {
  operationId: text("operation_id").primaryKey(),
  taskId: text("task_id")
    .references(() => processingTasks.taskId, { onDelete: "cascade" })
    .notNull(),
  paragraphId: text("paragraph_id").notNull(),
  optionId: text("option_id"),
  operationType: text("operation_type")
    .$type<TaskEditOperationType>()
    .notNull(),
  handlingStatus: text("handling_status")
    .$type<TaskRiskHandlingStatus>()
    .notNull(),
  appliedText: text("applied_text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});