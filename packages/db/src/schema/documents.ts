import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalFileName: text("original_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
