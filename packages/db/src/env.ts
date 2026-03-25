import { z } from "zod";

const databaseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
  AI_REWRITE_DB_DRIVER: z.enum(["memory", "postgres"]).optional(),
  DATABASE_URL: z.string().min(1).optional(),
});

export type DatabaseRuntimeConfig = {
  nodeEnv: "development" | "test" | "production";
  driver: "memory" | "postgres";
  databaseUrl: string | null;
};

export function getDatabaseRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseRuntimeConfig {
  const parsed = databaseEnvSchema.parse(env);
  const driver =
    parsed.AI_REWRITE_DB_DRIVER ??
    (parsed.DATABASE_URL ? "postgres" : parsed.NODE_ENV === "production"
      ? "postgres"
      : "memory");

  if (driver === "postgres" && !parsed.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required when AI_REWRITE_DB_DRIVER=postgres or in production.",
    );
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    driver,
    databaseUrl: parsed.DATABASE_URL ?? null,
  };
}
