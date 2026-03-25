import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  TaskSegmentConfidenceBucket,
  TaskSegmentContextStatus,
} from "@ai-rewrite/contracts";

import { processingTasks } from "./processing-tasks.ts";

export const documentSegments = pgTable(
  "document_segments",
  {
    segmentId: text("segment_id").primaryKey(),
    taskId: text("task_id")
      .references(() => processingTasks.taskId, { onDelete: "cascade" })
      .notNull(),
    paragraphId: text("paragraph_id").notNull(),
    originalText: text("original_text").notNull(),
    previousContext: text("previous_context"),
    nextContext: text("next_context"),
    diagnosisReason: text("diagnosis_reason").notNull(),
    confidenceBucket: text("confidence_bucket")
      .$type<TaskSegmentConfidenceBucket>()
      .notNull(),
    confidenceLabel: text("confidence_label").notNull(),
    confidenceSummary: text("confidence_summary").notNull(),
    contextStatus: text("context_status")
      .$type<TaskSegmentContextStatus>()
      .notNull(),
    contextStatusLabel: text("context_status_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    taskParagraphUnique: uniqueIndex("document_segments_task_paragraph_idx").on(
      table.taskId,
      table.paragraphId,
    ),
  }),
);
