import { defineConfig } from "drizzle-kit";

import { getDatabaseRuntimeConfig } from "./src/env.ts";

const databaseConfig = getDatabaseRuntimeConfig(process.env);

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials: {
    url:
      databaseConfig.databaseUrl ??
      "postgres://postgres:postgres@127.0.0.1:5432/ai_rewrite_workbench",
  },
});
