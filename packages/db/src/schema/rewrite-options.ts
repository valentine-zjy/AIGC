import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { processingTasks } from "./processing-tasks.ts";

export const rewriteOptions = pgTable(
  "rewrite_options",
  {
    optionId: text("option_id").primaryKey(),
    taskId: text("task_id")
      .references(() => processingTasks.taskId, { onDelete: "cascade" })
      .notNull(),
    paragraphId: text("paragraph_id").notNull(),
    optionRank: integer("option_rank").notNull(),
    title: text("title").notNull(),
    strategyLabel: text("strategy_label").notNull(),
    candidateText: text("candidate_text").notNull(),
    rationale: text("rationale").notNull(),
    diffSummary: text("diff_summary").notNull(),
    isRecommended: boolean("is_recommended").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    taskParagraphRankUnique: uniqueIndex(
      "rewrite_options_task_paragraph_rank_idx",
    ).on(table.taskId, table.paragraphId, table.optionRank),
  }),
);