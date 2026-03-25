import {
  uploadErrorEnvelopeSchema,
  uploadAcceptedEnvelopeSchema,
  type UploadAcceptedData,
  type UploadApiErrorCode,
} from "@ai-rewrite/contracts";

import { getUploadFeedbackCopy } from "./upload-feedback.ts";

export type UploadRequestResult =
  | {
      kind: "accepted";
      data: UploadAcceptedData;
    }
  | {
      kind: "error";
      code: UploadApiErrorCode;
      title: string;
      detail: string;
      nextStep: string;
    };

export async function submitUploadRequest({
  document,
  csrfToken,
  fetchImpl = fetch,
}: {
  document: File;
  csrfToken: string;
  fetchImpl?: typeof fetch;
}): Promise<UploadRequestResult> {
  const formData = new FormData();
  formData.set("document", document);
  formData.set("_csrf", csrfToken);

  let response: Response;

  try {
    response = await fetchImpl("/api/uploads", {
      method: "POST",
      body: formData,
    });
  } catch {
    const feedback = getUploadFeedbackCopy("upload_unavailable");

    return {
      kind: "error",
      code: "upload_unavailable",
      title: feedback.title,
      detail: feedback.detail,
      nextStep: feedback.nextStep,
    };
  }

  let payload: unknown = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const parsedError = uploadErrorEnvelopeSchema.safeParse(payload);
    const errorCode: UploadApiErrorCode = parsedError.success
      ? parsedError.data.error.code
      : "upload_unavailable";
    const feedback = getUploadFeedbackCopy(errorCode);

    return {
      kind: "error",
      code: errorCode,
      title: feedback.title,
      detail: parsedError.success
        ? parsedError.data.error.message
        : feedback.detail,
      nextStep: parsedError.success
        ? (parsedError.data.error.nextStep ?? feedback.nextStep)
        : feedback.nextStep,
    };
  }

  const accepted = uploadAcceptedEnvelopeSchema.safeParse(payload);

  if (!accepted.success) {
    const feedback = getUploadFeedbackCopy("upload_unavailable");

    return {
      kind: "error",
      code: "upload_unavailable",
      title: feedback.title,
      detail: feedback.detail,
      nextStep: feedback.nextStep,
    };
  }

  return {
    kind: "accepted",
    data: accepted.data.data,
  };
}
