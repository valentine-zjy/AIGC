import { S3Client } from "@aws-sdk/client-s3";

import { getStorageRuntimeConfig } from "./env.ts";

let client: S3Client | null = null;

export function getR2Client() {
  const config = getStorageRuntimeConfig(process.env);

  if (config.driver !== "r2") {
    throw new Error("R2 client is only available for r2 driver.");
  }

  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });
  }

  return client;
}
