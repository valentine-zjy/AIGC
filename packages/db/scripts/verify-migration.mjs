import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "../migrations/0000_task_persistence.sql",
);
const migrationSql = await readFile(migrationPath, "utf8");

for (const fragment of [
  'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
  'CREATE TABLE "documents"',
  'CREATE TABLE "document_assets"',
  'CREATE TABLE "processing_tasks"',
  'CREATE TABLE "risk_findings"',
  'CREATE TABLE "document_segments"',
  'CREATE TABLE "rewrite_options"',
  'CREATE TABLE "edit_operations"',
  'CREATE UNIQUE INDEX "document_segments_task_paragraph_idx"',
  'CREATE UNIQUE INDEX "rewrite_options_task_paragraph_rank_idx"',
  '"task_id" text NOT NULL UNIQUE',
  '"progress_percent" integer NOT NULL',
  '"status_message" text NOT NULL',
  '"next_step" text NOT NULL',
  '"retryable" boolean DEFAULT false NOT NULL',
  '"failure_code" text',
  '"failure_stage" text',
  '"failure_message" text',
  '"access_token_hash" text NOT NULL',
  '"object_key" text NOT NULL UNIQUE',
  '"finding_id" text PRIMARY KEY NOT NULL',
  '"task_id" text NOT NULL REFERENCES "processing_tasks"("task_id") ON DELETE CASCADE',
  '"paragraph_id" text NOT NULL',
  '"risk_level" text NOT NULL',
  '"issue_type" text NOT NULL',
  '"issue_type_label" text NOT NULL',
  '"issue_type_summary" text NOT NULL',
  '"excerpt" text NOT NULL',
  '"score" integer NOT NULL',
  '"handling_status" text NOT NULL',
  '"segment_id" text PRIMARY KEY NOT NULL',
  '"original_text" text NOT NULL',
  '"diagnosis_reason" text NOT NULL',
  '"confidence_bucket" text NOT NULL',
  '"confidence_label" text NOT NULL',
  '"confidence_summary" text NOT NULL',
  '"context_status" text NOT NULL',
  '"context_status_label" text NOT NULL',
  '"option_id" text PRIMARY KEY NOT NULL',
  '"option_rank" integer NOT NULL',
  '"title" text NOT NULL',
  '"strategy_label" text NOT NULL',
  '"candidate_text" text NOT NULL',
  '"rationale" text NOT NULL',
  '"diff_summary" text NOT NULL',
  '"is_recommended" boolean DEFAULT false NOT NULL',
  '"operation_id" text PRIMARY KEY NOT NULL',
  '"operation_type" text NOT NULL',
  '"applied_text" text',
]) {
  assert.ok(
    migrationSql.includes(fragment),
    `Migration is missing expected SQL fragment: ${fragment}`,
  );
}

console.log("db migration verification passed");