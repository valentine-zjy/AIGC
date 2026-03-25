import { z } from "zod";

import { processingModes } from "@ai-rewrite/contracts";

import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
  formatFileSize,
  getSupportedUploadFormat,
} from "./upload-constraints.ts";
import type { UploadIssue } from "./upload-feedback.ts";

type UploadValidationOptions = {
  allowEmptyMime: boolean;
};

type UploadValidationResult = {
  ok: boolean;
  issues: UploadIssue[];
};

export function inspectUploadFile(
  file: File | undefined,
  options: UploadValidationOptions,
): UploadValidationResult {
  const issues: UploadIssue[] = [];

  if (!file) {
    issues.push({
      code: "missing_file",
      message: "Choose a Word, PDF, or TXT file before submitting.",
    });

    return { ok: false, issues };
  }

  const supportedFormat = getSupportedUploadFormat(file.name);

  if (!supportedFormat) {
    issues.push({
      code: "unsupported_extension",
      message: "Only .doc, .docx, .pdf, and .txt files are supported.",
    });
  }

  if (file.size <= 0) {
    issues.push({
      code: "empty_file",
      message: "The selected file is empty and cannot create a task.",
    });
  }

  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    issues.push({
      code: "file_too_large",
      message: `The file exceeds ${MAX_UPLOAD_FILE_SIZE_LABEL}. Current size: ${formatFileSize(file.size)}.`,
    });
  }

  if (supportedFormat) {
    const fileMime = file.type.trim().toLowerCase();

    if (!fileMime && !options.allowEmptyMime) {
      issues.push({
        code: "mime_mismatch",
        message: "The MIME type could not be verified for this upload.",
      });
    }

    if (fileMime && !supportedFormat.mimeTypes.includes(fileMime)) {
      issues.push({
        code: "mime_mismatch",
        message: `The file extension and MIME type do not match. Detected MIME: ${fileMime}.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

function createUploadFileSchema(options: UploadValidationOptions) {
  return z
    .custom<File | undefined>((value) => {
      return value === undefined || value instanceof File;
    })
    .superRefine((file, ctx) => {
      const result = inspectUploadFile(file, options);

      for (const issue of result.issues) {
        ctx.addIssue({
          code: "custom",
          message: issue.message,
        });
      }
    });
}

export const clientUploadSchema = z.object({
  document: createUploadFileSchema({ allowEmptyMime: true }),
});

export const serverUploadSchema = z.object({
  mode: z.enum(processingModes),
  document: createUploadFileSchema({ allowEmptyMime: false }),
});
