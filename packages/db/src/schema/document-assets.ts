import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { documents } from "./documents.ts";

export const documentAssets = pgTable("document_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .references(() => documents.id)
    .notNull(),
  storageProvider: text("storage_provider").notNull(),
  bucketName: text("bucket_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  checksumSha256: text("checksum_sha256").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
