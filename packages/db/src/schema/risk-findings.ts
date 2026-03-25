import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type {
  TaskRiskHandlingStatus,
  TaskRiskIssueType,
  TaskRiskLevel,
} from "@ai-rewrite/contracts";

import { processingTasks } from "./processing-tasks.ts";

export const riskFindings = pgTable("risk_findings", {
  findingId: text("finding_id").primaryKey(),
  taskId: text("task_id")
    .references(() => processingTasks.taskId, { onDelete: "cascade" })
    .notNull(),
  paragraphId: text("paragraph_id").notNull(),
  riskLevel: text("risk_level").$type<TaskRiskLevel>().notNull(),
  issueType: text("issue_type").$type<TaskRiskIssueType>().notNull(),
  issueTypeLabel: text("issue_type_label").notNull(),
  issueTypeSummary: text("issue_type_summary").notNull(),
  excerpt: text("excerpt").notNull(),
  score: integer("score").notNull(),
  handlingStatus: text("handling_status")
    .$type<TaskRiskHandlingStatus>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});