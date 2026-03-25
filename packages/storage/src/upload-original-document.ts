import { createHash } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { getStorageRuntimeConfig } from "./env.ts";
import { getR2Client } from "./r2-client.ts";

export type StoreOriginalDocumentInput = {
  taskId: string;
  sessionId: string;
  file: File;
};

export type StoredOriginalDocument = {
  storageProvider: "memory" | "r2";
  bucketName: string;
  objectKey: string;
  checksumSha256: string;
  contentType: string;
  byteSize: number;
};

export interface OriginalDocumentStorage {
  storeOriginalDocument(
    input: StoreOriginalDocumentInput,
  ): Promise<StoredOriginalDocument>;
  deleteOriginalDocument(objectKey: string): Promise<void>;
}

const memoryObjects = new Map<
  string,
  {
    buffer: Buffer;
    bucketName: string;
    contentType: string;
  }
>();

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

async function toBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

function getChecksumSha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createObjectKey({
  taskId,
  sessionId,
  fileName,
}: {
  taskId: string;
  sessionId: string;
  fileName: string;
}) {
  return `${sessionId}/${taskId}/original/${Date.now()}-${sanitizeFileName(fileName)}`;
}

function createMemoryStorage(): OriginalDocumentStorage {
  return {
    async storeOriginalDocument({ taskId, sessionId, file }) {
      const buffer = await toBuffer(file);
      const objectKey = createObjectKey({
        taskId,
        sessionId,
        fileName: file.name,
      });
      const bucketName = "memory-private-originals";
      const contentType = file.type || "application/octet-stream";

      memoryObjects.set(objectKey, {
        buffer,
        bucketName,
        contentType,
      });

      return {
        storageProvider: "memory",
        bucketName,
        objectKey,
        checksumSha256: getChecksumSha256(buffer),
        contentType,
        byteSize: file.size,
      };
    },
    async deleteOriginalDocument(objectKey) {
      memoryObjects.delete(objectKey);
    },
  };
}

function createR2Storage(): OriginalDocumentStorage {
  const config = getStorageRuntimeConfig(process.env);
  const client = getR2Client();

  return {
    async storeOriginalDocument({ taskId, sessionId, file }) {
      const buffer = await toBuffer(file);
      const objectKey = createObjectKey({
        taskId,
        sessionId,
        fileName: file.name,
      });
      const contentType = file.type || "application/octet-stream";

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucketName!,
          Key: objectKey,
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            taskId,
            sessionId,
          },
        }),
      );

      return {
        storageProvider: "r2",
        bucketName: config.bucketName!,
        objectKey,
        checksumSha256: getChecksumSha256(buffer),
        contentType,
        byteSize: file.size,
      };
    },
    async deleteOriginalDocument(objectKey) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucketName!,
          Key: objectKey,
        }),
      );
    },
  };
}

let cachedStorage: OriginalDocumentStorage | null = null;

export function getOriginalDocumentStorage(): OriginalDocumentStorage {
  if (cachedStorage) {
    return cachedStorage;
  }

  const config = getStorageRuntimeConfig(process.env);
  cachedStorage =
    config.driver === "r2" ? createR2Storage() : createMemoryStorage();

  return cachedStorage;
}

export function resetOriginalDocumentStorageForTests() {
  memoryObjects.clear();
  cachedStorage = null;
}