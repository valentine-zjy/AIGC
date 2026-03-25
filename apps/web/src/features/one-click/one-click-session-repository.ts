import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { OneClickPreview } from "@ai-rewrite/contracts";

export type OneClickSessionEvent = {
  eventId: string;
  eventType: "start_preview" | "preview_ready" | "rollback_preview";
  createdAt: string;
  state: "processing" | "ready" | "rolled_back";
  message: string;
};

export type OneClickSessionRecord = {
  taskId: string;
  state: "processing" | "ready" | "rolled_back";
  startedAt: string;
  completedAt: string | null;
  rolledBackAt: string | null;
  preview: OneClickPreview | null;
  events: OneClickSessionEvent[];
};

const ROOT = path.join(tmpdir(), "ai-rewrite-dev-runtime", "one-click-sessions");

function filePath(taskId: string) {
  return path.join(ROOT, `${taskId}.json`);
}

async function ensureDir() {
  await mkdir(ROOT, { recursive: true });
}

function sortEvents(events: OneClickSessionEvent[]) {
  return [...events].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt, "zh-CN"),
  );
}

function normalizeSession(
  taskId: string,
  session: Omit<OneClickSessionRecord, "events"> & {
    events?: OneClickSessionEvent[];
  },
): OneClickSessionRecord {
  return {
    taskId,
    state: session.state,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    rolledBackAt: session.rolledBackAt,
    preview: session.preview,
    events: sortEvents(session.events ?? []),
  };
}

export async function readOneClickSession(
  taskId: string,
): Promise<OneClickSessionRecord | null> {
  try {
    const session = JSON.parse(await readFile(filePath(taskId), "utf8")) as
      | (Omit<OneClickSessionRecord, "events"> & {
          events?: OneClickSessionEvent[];
        })
      | null;

    return session ? normalizeSession(taskId, session) : null;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeOneClickSession(session: OneClickSessionRecord) {
  await ensureDir();
  const target = filePath(session.taskId);
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(session, null, 2), "utf8");
  await rename(temp, target);
}

export function createOneClickSessionEvent(input: {
  eventType: OneClickSessionEvent["eventType"];
  createdAt?: string;
  state: OneClickSessionEvent["state"];
  message: string;
}): OneClickSessionEvent {
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    createdAt: input.createdAt ?? new Date().toISOString(),
    state: input.state,
    message: input.message,
  };
}
