import { z } from "zod";

const storageEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .optional()
    .default("development"),
  AI_REWRITE_STORAGE_DRIVER: z.enum(["memory", "r2"]).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
});

export type StorageRuntimeConfig = {
  nodeEnv: "development" | "test" | "production";
  driver: "memory" | "r2";
  accountId: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  bucketName: string | null;
};

export function getStorageRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageRuntimeConfig {
  const parsed = storageEnvSchema.parse(env);
  const driver =
    parsed.AI_REWRITE_STORAGE_DRIVER ??
    (parsed.R2_BUCKET_NAME ? "r2" : parsed.NODE_ENV === "production"
      ? "r2"
      : "memory");

  if (
    driver === "r2" &&
    (!parsed.R2_ACCOUNT_ID ||
      !parsed.R2_ACCESS_KEY_ID ||
      !parsed.R2_SECRET_ACCESS_KEY ||
      !parsed.R2_BUCKET_NAME)
  ) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are required when AI_REWRITE_STORAGE_DRIVER=r2 or in production.",
    );
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    driver,
    accountId: parsed.R2_ACCOUNT_ID ?? null,
    accessKeyId: parsed.R2_ACCESS_KEY_ID ?? null,
    secretAccessKey: parsed.R2_SECRET_ACCESS_KEY ?? null,
    bucketName: parsed.R2_BUCKET_NAME ?? null,
  };
}
