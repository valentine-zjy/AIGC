import { boolean, integer, text, timestamp, pgTable, uuid } from "drizzle-orm/pg-core";

import type {
  ProcessingMode,
  TaskFailureCode,
  TaskStage,
  TaskStatus,
} from "@ai-rewrite/contracts";

import { documentAssets } from "./document-assets.ts";
import { documents } from "./documents.ts";

export const processingTasks = pgTable("processing_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: text("task_id").notNull().unique(),
  sessionId: text("session_id").notNull(),
  mode: text("mode").$type<ProcessingMode>().notNull(),
  status: text("status").$type<TaskStatus>().notNull(),
  stage: text("stage").$type<TaskStage>().notNull(),
  progressPercent: integer("progress_percent").notNull(),
  statusMessage: text("status_message").notNull(),
  nextStep: text("next_step").notNull(),
  retryable: boolean("retryable").notNull().default(false),
  failureCode: text("failure_code").$type<TaskFailureCode>(),
  failureStage: text("failure_stage").$type<TaskStage>(),
  failureMessage: text("failure_message"),
  accessTokenHash: text("access_token_hash").notNull(),
  documentId: uuid("document_id")
    .references(() => documents.id)
    .notNull(),
  assetId: uuid("asset_id")
    .references(() => documentAssets.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
