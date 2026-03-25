"use client";

import { useState } from "react";

import type { TaskRiskHandlingStatus } from "@ai-rewrite/contracts";

import { isPdfMimeType } from "../tasks/task-format-boundary";
import {
  TaskRewriteOptionRequestError,
  useTaskRewriteOptionsQuery,
} from "./task-rewrite-options-query";
import { TaskDecisionBar } from "./task-decision-bar";

export function TaskRewriteComparator({
  taskId,
  paragraphId,
  mimeType,
  originalText,
  currentHandlingStatus,
  nextPendingParagraphId,
}: {
  taskId: string;
  paragraphId: string;
  mimeType: string;
  originalText: string | null;
  currentHandlingStatus: TaskRiskHandlingStatus;
  nextPendingParagraphId: string | null;
}) {
  const pdfTask = isPdfMimeType(mimeType);
  const rewriteQuery = useTaskRewriteOptionsQuery({
    taskId,
    paragraphId,
    enabled: !pdfTask,
  });
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  if (pdfTask) {
    return (
      <section aria-labelledby="rewrite-comparator-heading" className="mt-6">
        <h4
          id="rewrite-comparator-heading"
          className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
        >
          改写建议比较器
        </h4>
        <div className="mt-2 rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold text-amber-950">当前 PDF 仅提供只读扫描结果</p>
          <p className="mt-2">
            当前格式仍适合查看高风险段落、判定原因和文本化上下文，但不支持复杂版式场景下的局部改写比较与精确定向回写。
          </p>
          <p className="mt-2">
            如果你需要继续比较 2-3 个局部改写方案，建议改用 Word / TXT 重新进入完整精修链路。
          </p>
        </div>
      </section>
    );
  }

  if (rewriteQuery.error instanceof TaskRewriteOptionRequestError) {
    return (
      <section aria-labelledby="rewrite-comparator-heading" className="mt-6">
        <h4
          id="rewrite-comparator-heading"
          className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
        >
          改写建议比较器
        </h4>
        <div className="mt-2 rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm leading-6 text-rose-700">
          <p className="font-semibold text-rose-900">候选改写建议读取失败</p>
          <p className="mt-2">{rewriteQuery.error.message}</p>
          <p className="mt-2">
            {rewriteQuery.error.nextStep ?? "稍后刷新当前页面后重试。"}
          </p>
        </div>
      </section>
    );
  }

  if (rewriteQuery.isLoading || rewriteQuery.data?.state === "pending") {
    return (
      <section aria-labelledby="rewrite-comparator-heading" className="mt-6">
        <h4
          id="rewrite-comparator-heading"
          className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
        >
          改写建议比较器
        </h4>
        <div className="mt-2 rounded-3xl border border-sky-200 bg-sky-50/70 p-4 text-sm leading-6 text-sky-900">
          {rewriteQuery.data?.message ?? "正在读取当前段落的 2-3 个局部改写建议。"}
        </div>
      </section>
    );
  }

  if (rewriteQuery.data?.state === "unavailable" || !rewriteQuery.data) {
    return (
      <section aria-labelledby="rewrite-comparator-heading" className="mt-6">
        <h4
          id="rewrite-comparator-heading"
          className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
        >
          改写建议比较器
        </h4>
        <div className="mt-2 rounded-3xl border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold text-amber-950">当前段落的候选建议暂不可读</p>
          <p className="mt-2">{rewriteQuery.data?.message}</p>
        </div>
      </section>
    );
  }

  const defaultOption =
    rewriteQuery.data.options.find((option) => option.isRecommended) ??
    rewriteQuery.data.options[0] ??
    null;
  const selectedOption =
    rewriteQuery.data.options.find((option) => option.optionId === selectedOptionId) ??
    defaultOption;

  return (
    <section aria-labelledby="rewrite-comparator-heading" className="mt-6">
      <div className="flex flex-col gap-2">
        <h4
          id="rewrite-comparator-heading"
          className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]"
        >
          改写建议比较器
        </h4>
        <p className="text-sm leading-6 text-[var(--ink-body)]">
          {rewriteQuery.data.message}
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <article className="rounded-3xl border border-[var(--border-soft)] bg-white p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            原文对照
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-body)]">
            {originalText ?? "当前原文正文仍在诊断面板中加载。"}
          </p>
        </article>

        <div className="grid gap-4">
          {rewriteQuery.data.options.map((option) => {
            const isActive = selectedOption?.optionId === option.optionId;

            return (
              <article
                key={option.optionId}
                className={`rounded-3xl border p-4 transition ${
                  isActive
                    ? "border-[var(--ink-strong)] ring-2 ring-[var(--focus-ring)]"
                    : option.isRecommended
                      ? "border-[var(--accent-strong)] bg-[var(--surface-accent)]"
                      : "border-[var(--border-soft)] bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedOptionId(option.optionId)}
                  aria-pressed={isActive}
                  className="w-full text-left"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--ink-strong)]">
                    <span className="inline-flex rounded-full bg-[var(--surface-elevated)] px-3 py-1">
                      方案 {option.optionRank}
                    </span>
                    <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sky-900">
                      {option.strategyLabel}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 ${
                        option.isRecommended
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {option.isRecommended ? "推荐建议" : "备选建议"}
                    </span>
                    {isActive ? (
                      <span className="inline-flex rounded-full bg-[var(--ink-strong)] px-3 py-1 text-white">
                        当前决策方案
                      </span>
                    ) : null}
                  </div>

                  <h5 className="mt-3 text-base font-semibold text-[var(--ink-strong)]">
                    {option.title}
                  </h5>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-body)]">
                    {option.candidateText}
                  </p>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-3 text-sm leading-6 text-[var(--ink-body)]">
                      <p className="font-semibold text-[var(--ink-strong)]">差异提示</p>
                      <p className="mt-2">{option.diffSummary}</p>
                    </div>
                    <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-3 text-sm leading-6 text-[var(--ink-body)]">
                      <p className="font-semibold text-[var(--ink-strong)]">改写理由</p>
                      <p className="mt-2">{option.rationale}</p>
                    </div>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      </div>

      {selectedOption ? (
        <TaskDecisionBar
          taskId={taskId}
          paragraphId={paragraphId}
          optionId={selectedOption.optionId}
          nextParagraphId={nextPendingParagraphId}
          currentHandlingStatus={currentHandlingStatus}
        />
      ) : null}
    </section>
  );
}