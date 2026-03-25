import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const TASK_CONTEXT_COOKIE = "ai_rewrite_task_context";

export const processingModes = ["workbench", "one-click"] as const;

export type ProcessingMode = (typeof processingModes)[number];

export type AnonymousTaskContext = {
  sessionId: string;
  bootstrapToken: string;
  mode: ProcessingMode;
  issuedAt: string;
};

type SerializedTaskContextPayload = {
  sessionId: string;
  bootstrapToken: string;
  mode: ProcessingMode;
  issuedAt: string;
};

const TASK_CONTEXT_SECRET_FALLBACK =
  "local-dev-ai-rewrite-task-context-secret";

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
): AnonymousTaskContext {
  return {
    sessionId: randomUUID(),
    bootstrapToken: randomBytes(18).toString("base64url"),
    mode,
    issuedAt: new Date().toISOString(),
  };
}

function getTaskContextSecret(): string | null {
  if (process.env.TASK_CONTEXT_SECRET) {
    return process.env.TASK_CONTEXT_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return TASK_CONTEXT_SECRET_FALLBACK;
}

function toPayload(context: AnonymousTaskContext): SerializedTaskContextPayload {
  return {
    sessionId: context.sessionId,
    bootstrapToken: context.bootstrapToken,
    mode: context.mode,
    issuedAt: context.issuedAt,
  };
}

function encodePayload(payload: SerializedTaskContextPayload): string {
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

export function serializeTaskContext(context: AnonymousTaskContext): string {
  const encodedPayload = encodePayload(toPayload(context));

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function parseStoredTaskContext(
  raw: string | undefined,
): AnonymousTaskContext | null {
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

  const parsed = decodePayload(encodedPayload);

  if (
    !parsed ||
    typeof parsed.sessionId !== "string" ||
    typeof parsed.bootstrapToken !== "string" ||
    typeof parsed.issuedAt !== "string"
  ) {
    return null;
  }

  const mode = parseRequestedMode(parsed.mode);

  if (!mode) {
    return null;
  }

  return {
    sessionId: parsed.sessionId,
    bootstrapToken: parsed.bootstrapToken,
    mode,
    issuedAt: parsed.issuedAt,
  };
}