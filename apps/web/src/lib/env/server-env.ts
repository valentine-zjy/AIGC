import { z } from "zod";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 4;
const TASK_CONTEXT_SECRET_FALLBACK =
  "local-dev-ai-rewrite-task-context-secret";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
  TASK_CONTEXT_SECRET: z.string().min(1).optional(),
  AI_REWRITE_COOKIE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(COOKIE_MAX_AGE_SECONDS),
  AI_REWRITE_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(7),
});

export type ServerEnv = {
  nodeEnv: "development" | "test" | "production";
  taskContextSecret: string | null;
  cookieMaxAgeSeconds: number;
  retentionDays: number;
};

export function getServerEnv(
  env: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const parsed = serverEnvSchema.parse(env);
  const taskContextSecret =
    parsed.TASK_CONTEXT_SECRET ??
    (parsed.NODE_ENV === "production" ? null : TASK_CONTEXT_SECRET_FALLBACK);

  return {
    nodeEnv: parsed.NODE_ENV,
    taskContextSecret,
    cookieMaxAgeSeconds: parsed.AI_REWRITE_COOKIE_MAX_AGE_SECONDS,
    retentionDays: parsed.AI_REWRITE_RETENTION_DAYS,
  };
}
