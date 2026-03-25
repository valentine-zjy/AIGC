CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "original_file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "document_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL REFERENCES "documents"("id"),
  "storage_provider" text NOT NULL,
  "bucket_name" text NOT NULL,
  "object_key" text NOT NULL UNIQUE,
  "checksum_sha256" text NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "processing_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" text NOT NULL UNIQUE,
  "session_id" text NOT NULL,
  "mode" text NOT NULL,
  "status" text NOT NULL,
  "stage" text NOT NULL,
  "progress_percent" integer NOT NULL,
  "status_message" text NOT NULL,
  "next_step" text NOT NULL,
  "retryable" boolean DEFAULT false NOT NULL,
  "failure_code" text,
  "failure_stage" text,
  "failure_message" text,
  "access_token_hash" text NOT NULL,
  "document_id" uuid NOT NULL REFERENCES "documents"("id"),
  "asset_id" uuid NOT NULL REFERENCES "document_assets"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "risk_findings" (
  "finding_id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "processing_tasks"("task_id") ON DELETE CASCADE,
  "paragraph_id" text NOT NULL,
  "risk_level" text NOT NULL,
  "issue_type" text NOT NULL,
  "issue_type_label" text NOT NULL,
  "issue_type_summary" text NOT NULL,
  "excerpt" text NOT NULL,
  "score" integer NOT NULL,
  "handling_status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "document_segments" (
  "segment_id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "processing_tasks"("task_id") ON DELETE CASCADE,
  "paragraph_id" text NOT NULL,
  "original_text" text NOT NULL,
  "previous_context" text,
  "next_context" text,
  "diagnosis_reason" text NOT NULL,
  "confidence_bucket" text NOT NULL,
  "confidence_label" text NOT NULL,
  "confidence_summary" text NOT NULL,
  "context_status" text NOT NULL,
  "context_status_label" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "document_segments_task_paragraph_idx"
  ON "document_segments" ("task_id", "paragraph_id");


CREATE TABLE "rewrite_options" (
  "option_id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "processing_tasks"("task_id") ON DELETE CASCADE,
  "paragraph_id" text NOT NULL,
  "option_rank" integer NOT NULL,
  "title" text NOT NULL,
  "strategy_label" text NOT NULL,
  "candidate_text" text NOT NULL,
  "rationale" text NOT NULL,
  "diff_summary" text NOT NULL,
  "is_recommended" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "rewrite_options_task_paragraph_rank_idx"
  ON "rewrite_options" ("task_id", "paragraph_id", "option_rank");
CREATE TABLE "edit_operations" (
  "operation_id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "processing_tasks"("task_id") ON DELETE CASCADE,
  "paragraph_id" text NOT NULL,
  "option_id" text,
  "operation_type" text NOT NULL,
  "handling_status" text NOT NULL,
  "applied_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);