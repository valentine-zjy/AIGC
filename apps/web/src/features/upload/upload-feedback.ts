export type UploadIssueCode =
  | "missing_file"
  | "empty_file"
  | "unsupported_extension"
  | "mime_mismatch"
  | "file_too_large";

export type UploadIssue = {
  code: UploadIssueCode;
  message: string;
};

export type UploadApiErrorCode =
  | UploadIssueCode
  | "missing_context"
  | "rate_limited"
  | "upload_unavailable"
  | "csrf_invalid"
  | "unauthorized_task_access"
  | "task_not_found";

export type UploadFeedbackCopy = {
  title: string;
  detail: string;
  nextStep: string;
};

const uploadFeedbackMap: Record<UploadApiErrorCode, UploadFeedbackCopy> = {
  missing_file: {
    title: "No file selected",
    detail: "Choose a Word, PDF, or TXT file before submitting.",
    nextStep: "Pick a file and upload again.",
  },
  empty_file: {
    title: "The file is empty",
    detail: "No processable content was detected, so the task was not created.",
    nextStep: "Check the export or pick a non-empty file and try again.",
  },
  unsupported_extension: {
    title: "Unsupported file format",
    detail: "This intake only accepts Word, PDF, or TXT files.",
    nextStep: "Use a .doc, .docx, .pdf, or .txt file.",
  },
  mime_mismatch: {
    title: "File type validation failed",
    detail: "The file extension and MIME type do not match, so task creation was blocked.",
    nextStep: "Re-export the file and make sure the extension is correct before uploading again.",
  },
  file_too_large: {
    title: "File exceeds the current intake limit",
    detail: "The file is larger than the MVP upload limit, so the system did not accept it.",
    nextStep: "Reduce the scope or split the content before uploading again.",
  },
  missing_context: {
    title: "Upload context has expired",
    detail: "This request did not include a trusted anonymous task context, so it was not accepted.",
    nextStep: "Return to the home page, choose a mode again, and then retry the upload.",
  },
  csrf_invalid: {
    title: "Trusted submission check failed",
    detail: "The upload request did not pass the CSRF trust checks required for cookie-bound task creation.",
    nextStep: "Refresh the upload page and submit again from the trusted app UI.",
  },
  rate_limited: {
    title: "Too many requests",
    detail: "The system temporarily limited repeated upload requests to protect the intake path.",
    nextStep: "Wait a moment before trying again.",
  },
  upload_unavailable: {
    title: "Upload is temporarily unavailable",
    detail: "The intake step did not complete, but the system did not silently swallow the request.",
    nextStep: "Try again shortly, or restart from mode selection.",
  },
  unauthorized_task_access: {
    title: "Task access is not authorized",
    detail: "The current task token does not authorize access to this task.",
    nextStep: "Return to the accepted task link or create a new task session.",
  },
  task_not_found: {
    title: "Task record not found",
    detail: "The task could not be restored from persistence.",
    nextStep: "Create a new task if the previous one has expired.",
  },
};

export function getUploadFeedbackCopy(
  code: UploadApiErrorCode,
): UploadFeedbackCopy {
  return uploadFeedbackMap[code];
}
