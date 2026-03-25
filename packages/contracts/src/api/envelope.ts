import { z } from "zod";

export const responseMetaSchema = z.object({
  requestId: z.string().min(1).optional(),
  timestamp: z.string().datetime(),
});

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  nextStep: z.string().min(1).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ResponseMeta = z.infer<typeof responseMetaSchema>;

export function successEnvelopeSchema<TSchema extends z.ZodType>(
  dataSchema: TSchema,
) {
  return z.object({
    data: dataSchema,
    error: z.null(),
    meta: responseMetaSchema,
  });
}

export function errorEnvelopeSchema<TSchema extends z.ZodType>(
  errorSchema?: TSchema,
) {
  const resolvedErrorSchema = (errorSchema ?? apiErrorSchema) as unknown as TSchema;

  return z.object({
    data: z.null(),
    error: resolvedErrorSchema,
    meta: responseMetaSchema,
  });
}

export function createSuccessEnvelope<TData>(
  data: TData,
  meta: Partial<ResponseMeta> = {},
) {
  return {
    data,
    error: null,
    meta: {
      timestamp: meta.timestamp ?? new Date().toISOString(),
      ...(meta.requestId ? { requestId: meta.requestId } : {}),
    },
  };
}

export function createErrorEnvelope(
  error: ApiError,
  meta: Partial<ResponseMeta> = {},
) {
  return {
    data: null,
    error,
    meta: {
      timestamp: meta.timestamp ?? new Date().toISOString(),
      ...(meta.requestId ? { requestId: meta.requestId } : {}),
    },
  };
}