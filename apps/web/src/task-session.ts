import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  processingModes,
  type ProcessingMode,
  type TaskDeletionReason,
} from "@ai-rewrite/contracts";

import { getServerEnv } from "./lib/env/server-env.ts";

export const TASK_CONTEXT_COOKIE = "ai_rewrite_task_context";

type BaseTaskContext = {
  sessionId: string;
  mode: ProcessingMode;
  issuedAt: string;
};

export type BootstrapTaskContext = BaseTaskContext & {
  kind: "bootstrap";
  bootstrapToken: string;
  csrfToken: string;
};

export type TaskAccessContext = BaseTaskContext & {
  kind: "task";
  taskId: string;
  accessToken: string;
  csrfToken: string;
};

export type DeletedTaskContext = BaseTaskContext & {
  kind: "deleted";
  taskId: string;
  deletedAt: string;
  reason: TaskDeletionReason;
};

type LegacyBootstrapPayload = BaseTaskContext & {
  bootstrapToken: string;
};

type SerializedTaskContextPayload =
  | BootstrapTaskContext
  | TaskAccessContext
  | DeletedTaskContext
  | LegacyBootstrapPayload;

export type StoredTaskContext =
  | BootstrapTaskContext
  | TaskAccessContext
  | DeletedTaskContext;
export type AnonymousTaskContext = BootstrapTaskContext;

export function isTaskContextSigningAvailable(): boolean {
  return getTaskContextSecret() !== null;
}

export function parseRequestedMode(
  value: string | null | undefined,
): ProcessingMode | null {
  if (!value) {
    return null;
  }

  return processingModes.includes(value as ProcessingMode)
    ? (value as ProcessingMode)
    : null;
}

export function createAnonymousTaskContext(
  mode: ProcessingMode,
): BootstrapTaskContext {
  return {
    kind: "bootstrap",
    sessionId: randomUUID(),
    bootstrapToken: randomBytes(18).toString("base64url"),
    csrfToken: randomBytes(18).toString("base64url"),
    mode,
    issuedAt: new Date().toISOString(),
  };
}

export function createTaskAccessContext({
  sessionId,
  taskId,
  mode,
  accessToken,
  csrfToken = randomBytes(18).toString("base64url"),
}: {
  sessionId: string;
  taskId: string;
  mode: ProcessingMode;
  accessToken: string;
  csrfToken?: string;
}): TaskAccessContext {
  return {
    kind: "task",
    sessionId,
    taskId,
    accessToken,
    csrfToken,
    mode,
    issuedAt: new Date().toISOString(),
  };
}

export function createDeletedTaskContext({
  sessionId,
  taskId,
  mode,
  reason,
  deletedAt = new Date().toISOString(),
}: {
  sessionId: string;
  taskId: string;
  mode: ProcessingMode;
  reason: TaskDeletionReason;
  deletedAt?: string;
}): DeletedTaskContext {
  return {
    kind: "deleted",
    sessionId,
    taskId,
    deletedAt,
    reason,
    mode,
    issuedAt: deletedAt,
  };
}

export function createTaskAccessToken() {
  const accessToken = randomBytes(24).toString("base64url");

  return {
    accessToken,
    accessTokenHash: getTaskAccessTokenHash(accessToken),
  };
}

export function getTaskAccessTokenHash(accessToken: string) {
  return createHash("sha256").update(accessToken).digest("hex");
}

export function isBootstrapTaskContext(
  value: StoredTaskContext | null,
): value is BootstrapTaskContext {
  return value?.kind === "bootstrap";
}

export function isTaskAccessContext(
  value: StoredTaskContext | null,
): value is TaskAccessContext {
  return value?.kind === "task";
}

export function isDeletedTaskContext(
  value: StoredTaskContext | null,
): value is DeletedTaskContext {
  return value?.kind === "deleted";
}

export function buildTaskContextCookie(value: string): string {
  const env = getServerEnv();
  const parts = [
    `${TASK_CONTEXT_COOKIE}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${env.cookieMaxAgeSeconds}`,
  ];

  if (env.nodeEnv === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function getTaskContextSecret(): string | null {
  return getServerEnv().taskContextSecret;
}

function encodePayload(payload: StoredTaskContext): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(
  encodedPayload: string,
): SerializedTaskContextPayload | null {
  try {
    return JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SerializedTaskContextPayload;
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string): string {
  const secret = getTaskContextSecret();

  if (!secret) {
    throw new Error("TASK_CONTEXT_SECRET is required in production.");
  }

  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

function isSignatureValid(
  encodedPayload: string,
  providedSignature: string,
): boolean {
  const secret = getTaskContextSecret();

  if (!secret) {
    return false;
  }

  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");

    return timingSafeEqual(
      Buffer.from(providedSignature, "utf8"),
      Buffer.from(expectedSignature, "utf8"),
    );
  } catch {
    return false;
  }
}

function toStoredTaskContext(
  payload: SerializedTaskContextPayload | null,
): StoredTaskContext | null {
  if (
    !payload ||
    typeof payload.sessionId !== "string" ||
    typeof payload.issuedAt !== "string"
  ) {
    return null;
  }

  const mode = parseRequestedMode(payload.mode);

  if (!mode) {
    return null;
  }

  if ("kind" in payload && payload.kind === "task") {
    if (
      typeof payload.taskId !== "string" ||
      typeof payload.accessToken !== "string"
    ) {
      return null;
    }

    return {
      kind: "task",
      sessionId: payload.sessionId,
      taskId: payload.taskId,
      accessToken: payload.accessToken,
      csrfToken:
        typeof payload.csrfToken === "string" && payload.csrfToken.length > 0
          ? payload.csrfToken
          : payload.accessToken,
      mode,
      issuedAt: payload.issuedAt,
    };
  }

  if ("kind" in payload && payload.kind === "deleted") {
    if (
      typeof payload.taskId !== "string" ||
      typeof payload.deletedAt !== "string" ||
      (payload.reason !== "user_requested" && payload.reason !== "expired")
    ) {
      return null;
    }

    return {
      kind: "deleted",
      sessionId: payload.sessionId,
      taskId: payload.taskId,
      deletedAt: payload.deletedAt,
      reason: payload.reason,
      mode,
      issuedAt: payload.issuedAt,
    };
  }

  if (typeof payload.bootstrapToken !== "string") {
    return null;
  }

  return {
    kind: "bootstrap",
    sessionId: payload.sessionId,
    bootstrapToken: payload.bootstrapToken,
    csrfToken:
      "csrfToken" in payload && typeof payload.csrfToken === "string"
        ? payload.csrfToken
        : payload.bootstrapToken,
    mode,
    issuedAt: payload.issuedAt,
  };
}

export function serializeTaskContext(context: StoredTaskContext): string {
  const encodedPayload = encodePayload(context);

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function parseStoredTaskContext(
  raw: string | undefined,
): StoredTaskContext | null {
  if (!raw) {
    return null;
  }

  const [encodedPayload, signature] = raw.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!isSignatureValid(encodedPayload, signature)) {
    return null;
  }

  return toStoredTaskContext(decodePayload(encodedPayload));
}
