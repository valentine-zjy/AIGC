import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getDatabaseRuntimeConfig } from "./env.ts";
import * as schema from "./schema/index.ts";

let pool: Pool | null = null;
let database: NodePgDatabase<typeof schema> | null = null;

export function getDatabaseClient() {
  const config = getDatabaseRuntimeConfig(process.env);

  if (config.driver !== "postgres") {
    throw new Error("Database client is only available for postgres driver.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl ?? undefined,
    });
  }

  if (!database) {
    database = drizzle(pool, { schema });
  }

  return database;
}
