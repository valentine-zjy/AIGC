import type { ProcessingMode } from "@ai-rewrite/contracts";

import {
  isBootstrapTaskContext,
  type StoredTaskContext,
} from "../../task-session.ts";

export type UploadEntryState = {
  activeMode: ProcessingMode | null;
  hasTrustedContext: boolean;
  requestedMode: ProcessingMode | null;
};

export function getUploadEntryState({
  requestedMode,
  storedContext,
}: {
  requestedMode: ProcessingMode | null;
  storedContext: StoredTaskContext | null;
}): UploadEntryState {
  if (!storedContext || !isBootstrapTaskContext(storedContext)) {
    return {
      activeMode: null,
      hasTrustedContext: false,
      requestedMode,
    };
  }

  return {
    activeMode: storedContext.mode,
    hasTrustedContext: true,
    requestedMode,
  };
}
