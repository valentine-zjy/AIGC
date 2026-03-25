"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { ProcessingMode } from "@ai-rewrite/contracts";

import {
  buildDataPolicyItems,
  getUploadStageGuidance,
} from "../policies/data-governance-copy";
import { DataPolicyCard } from "../policies/DataPolicyCard";
import { FormatCapabilityCard } from "../policies/FormatCapabilityCard";
import { formatCapabilityMatrix } from "../policies/format-capability-matrix";
import { StageGuidanceCard } from "../policies/StageGuidanceCard";
import {
  ACCEPTED_UPLOAD_FILE_TYPES,
  MAX_UPLOAD_FILE_SIZE_LABEL,
  uploadModeLabels,
} from "./upload-constraints";
import { submitUploadRequest } from "./upload-request";
import { clientUploadSchema } from "./upload-schema";

type UploadFormValues = {
  document: FileList | null;
};

type SubmissionState =
  | { kind: "idle" }
  | { kind: "submitting"; message: string }
  | {
      kind: "accepted";
      title: string;
      detail: string;
      nextPath: string;
    }
  | {
      kind: "error";
      title: string;
      detail: string;
      nextStep: string;
    };

export function UploadForm({
  mode,
  csrfToken,
  retentionDays,
}: {
  mode: ProcessingMode;
  csrfToken: string;
  retentionDays: number;
}) {
  const router = useRouter();
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    kind: "idle",
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<UploadFormValues>({
    defaultValues: {
      document: null,
    },
  });

  useEffect(() => {
    if (submissionState.kind !== "accepted") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.push(submissionState.nextPath);
      });
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [router, submissionState]);

  const policyItems = buildDataPolicyItems({
    retentionDays,
    trainingUse: "excluded",
  });

  const stageGuidance = getUploadStageGuidance({
    state: submissionState.kind,
    retentionDays,
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors("document");

    const document = values.document?.item(0) ?? undefined;
    const validation = clientUploadSchema.safeParse({ document });

    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message ?? "请先选择一个可上传的文件。";

      setError("document", {
        type: "manual",
        message,
      });
      setSubmissionState({
        kind: "error",
        title: "当前文件暂时无法受理",
        detail: message,
        nextStep: "先修正文件问题，再重新提交。",
      });

      return;
    }

    if (!document) {
      return;
    }

    setSubmissionState({
      kind: "submitting",
      message: "正在校验文件并创建任务。",
    });

    const result = await submitUploadRequest({ document, csrfToken });

    if (result.kind === "error") {
      setSubmissionState({
        kind: "error",
        title: result.title,
        detail: result.detail,
        nextStep: result.nextStep,
      });

      return;
    }

    setSubmissionState({
      kind: "accepted",
      title: "任务已受理",
      detail: `${result.data.fileName} 已进入${uploadModeLabels[mode]}。`,
      nextPath: result.data.nextPath,
    });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-7 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          上传并创建任务
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
          {uploadModeLabels[mode]}已就绪
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--ink-body)]">
          这一步会先校验文件，再把可受理的上传转成新任务。格式能力、数据规则与当前阶段说明都固定展示在当前页右侧。
        </p>

        <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
          <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface-base)] p-5">
            <label
              htmlFor="document"
              className="text-sm font-semibold text-[var(--ink-strong)]"
            >
              选择文档
            </label>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
              支持 Word、PDF、TXT，单文件上限 {MAX_UPLOAD_FILE_SIZE_LABEL}。
            </p>
            <input
              {...register("document")}
              id="document"
              type="file"
              accept={ACCEPTED_UPLOAD_FILE_TYPES}
              aria-invalid={errors.document ? "true" : "false"}
              aria-describedby="document-help document-error"
              className="mt-4 block w-full rounded-[1.1rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-sm text-[var(--ink-strong)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--surface-accent)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--accent-strong)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            />
            <p
              id="document-help"
              className="mt-3 text-sm leading-6 text-[var(--ink-muted)]"
            >
              服务端会再次校验扩展名、MIME 类型与文件大小。
            </p>
            <p
              id="document-error"
              className="mt-2 min-h-6 text-sm font-medium text-[#8c2f2f]"
              role="alert"
            >
              {errors.document?.message}
            </p>
          </div>

          <button
            type="submit"
            disabled={submissionState.kind === "submitting"}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-strong)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            {submissionState.kind === "submitting" ? "正在受理..." : "上传并创建任务"}
          </button>
        </form>
      </section>

      <aside className="grid gap-5">
        <StageGuidanceCard
          title={stageGuidance.title}
          description={stageGuidance.description}
          items={stageGuidance.items}
        />
        <FormatCapabilityCard
          title="格式能力概览"
          description="在上传操作附近直接说明真实能力边界，避免用户离开当前流程后才看到限制。"
          entries={formatCapabilityMatrix}
        />
        <DataPolicyCard
          title="数据规则说明"
          items={policyItems}
          footer="任务页会继续固定展示删除入口说明、保留期与访问边界。当前故事只先把规则讲清楚，不冒充真实删除动作已经可用。"
        />
      </aside>
    </div>
  );
}
