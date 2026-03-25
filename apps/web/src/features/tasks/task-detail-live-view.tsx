"use client";

import Link from "next/link";
import { useState } from "react";

import { isTerminalTaskStatus, type TaskDetailData } from "@ai-rewrite/contracts";

import { TaskRiskWorkbench } from "../diagnosis/task-risk-workbench";
import { OneClickPanel } from "../one-click/one-click-panel";
import {
  buildDataPolicyItems,
  getTaskStageGuidance,
} from "../policies/data-governance-copy";
import { DataPolicyCard } from "../policies/DataPolicyCard";
import { FormatCapabilityCard } from "../policies/FormatCapabilityCard";
import { formatCapabilityMatrix } from "../policies/format-capability-matrix";
import { StageGuidanceCard } from "../policies/StageGuidanceCard";
import { formatFileSize, uploadModeLabels } from "../upload/upload-constraints";
import { submitTaskDeleteRequest } from "./task-delete-request";
import { buildTaskStatusViewModel, getTaskStageLabel } from "./task-status-copy";
import { TaskStatusRequestError, useTaskStatusQuery } from "./task-status-query";
import { TaskStatusRail } from "./task-status-rail";

function buildStatusAnnouncement(task: TaskDetailData) {
  const statusLabel = buildTaskStatusViewModel(task).statusLabel;

  return `任务 ${task.taskId} 当前处于 ${getTaskStageLabel(task.stage)} 阶段，状态 ${statusLabel}，进度 ${task.progressPercent}%。`;
}

function getReadErrorTitle(error: TaskStatusRequestError) {
  if (error.code === "task_deleted") {
    return "当前任务已删除";
  }

  if (error.code === "task_expired") {
    return "当前任务已超过保留期";
  }

  if (error.code === "unauthorized_task_access" || error.status === 401) {
    return "当前上下文无权访问该任务";
  }

  return "任务状态读取失败";
}

function FailurePanel({
  title,
  detail,
  nextStep,
}: {
  title: string;
  detail: string;
  nextStep: string;
}) {
  return (
    <section className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-6">
      <h2 className="text-xl font-semibold text-rose-800">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-rose-700">{detail}</p>
      <p className="mt-2 text-sm leading-6 text-rose-700">{nextStep}</p>
    </section>
  );
}

function SuccessPanel({
  title,
  detail,
  nextStep,
}: {
  title: string;
  detail: string;
  nextStep: string;
}) {
  return (
    <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50/80 p-6">
      <h2 className="text-xl font-semibold text-emerald-800">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-emerald-700">{detail}</p>
      <p className="mt-2 text-sm leading-6 text-emerald-700">{nextStep}</p>
    </section>
  );
}

type DeleteState =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "submitting" }
  | {
      kind: "deleted";
      message: string;
      nextStep: string;
    }
  | {
      kind: "error";
      title: string;
      detail: string;
      nextStep: string;
    };

export function TaskDetailLiveView({
  initialTask,
  taskCsrfToken,
}: {
  initialTask: TaskDetailData;
  taskCsrfToken: string | null;
}) {
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: "idle" });
  const [showOneClickWorkbench, setShowOneClickWorkbench] = useState(initialTask.mode === "workbench");
  const query = useTaskStatusQuery({
    taskId: initialTask.taskId,
    initialTask,
    enabled: deleteState.kind !== "deleted",
  });
  const task = query.data ?? initialTask;
  const viewModel = buildTaskStatusViewModel(task);
  const policyItems = buildDataPolicyItems({
    retentionDays: task.retentionDays,
    accessScope: task.accessScope,
    trainingUse: task.trainingUse,
  });
  const stageGuidance = getTaskStageGuidance(task);

  async function handleDeleteConfirm() {
    if (!taskCsrfToken) {
      setDeleteState({
        kind: "error",
        title: "无法发起删除",
        detail: "当前任务上下文缺少删除所需的 CSRF 令牌。",
        nextStep: "刷新当前任务页后重试；如果问题持续，请返回上传页重新进入。",
      });

      return;
    }

    setDeleteState({ kind: "submitting" });

    const result = await submitTaskDeleteRequest({
      taskId: task.taskId,
      csrfToken: taskCsrfToken,
    });

    if (result.kind === "deleted") {
      setDeleteState({
        kind: "deleted",
        message: result.data.message,
        nextStep: "当前任务已不可恢复访问。你可以返回上传页继续处理新文档。",
      });

      return;
    }

    setDeleteState({
      kind: "error",
      title:
        result.code === "task_expired"
          ? "任务已超过保留期"
          : result.code === "task_deleted"
            ? "任务已删除"
            : "删除当前任务失败",
      detail: result.message,
      nextStep:
        result.nextStep ?? "稍后重试删除；如果问题持续，请联系支持。",
    });
  }

  if (deleteState.kind === "deleted") {
    return (
      <div className="space-y-6">
        <SuccessPanel
          title="当前任务已删除"
          detail={deleteState.message}
          nextStep={deleteState.nextStep}
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/upload"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            返回上传页
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-accent)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  if (query.error instanceof TaskStatusRequestError) {
    return (
      <div className="space-y-6">
        <FailurePanel
          title={getReadErrorTitle(query.error)}
          detail={query.error.message}
          nextStep={
            query.error.nextStep ??
            "稍后刷新当前页面；如果问题持续，请返回上传页重新建立任务上下文。"
          }
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-accent)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            重新读取任务状态
          </button>
          <Link
            href="/upload"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            返回上传页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div aria-live="polite" className="sr-only">
        {buildStatusAnnouncement(task)}
      </div>

      <TaskStatusRail task={task} />

      <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              任务快照
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-strong)]">
              {task.fileName}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-body)]">
              {viewModel.helper}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
            >
              {query.isFetching ? "刷新中..." : "立即刷新"}
            </button>
            <div className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-body)]">
              {isTerminalTaskStatus(task.status) ? "轮询已停止" : "短轮询进行中"}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5">
            <dt className="text-sm font-semibold text-[var(--ink-strong)]">处理模式</dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
              {uploadModeLabels[task.mode]}
            </dd>
          </div>
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5">
            <dt className="text-sm font-semibold text-[var(--ink-strong)]">当前阶段</dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
              {getTaskStageLabel(task.stage)}
            </dd>
          </div>
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5">
            <dt className="text-sm font-semibold text-[var(--ink-strong)]">文件摘要</dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
              {task.mimeType} · {formatFileSize(task.fileSize)}
            </dd>
          </div>
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5">
            <dt className="text-sm font-semibold text-[var(--ink-strong)]">最近更新</dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
              {new Date(task.updatedAt).toLocaleString("zh-CN")}
            </dd>
          </div>
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 md:col-span-2">
            <dt className="text-sm font-semibold text-[var(--ink-strong)]">访问边界</dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
              {task.accessScope}
            </dd>
          </div>
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 md:col-span-2">
            <dt className="text-sm font-semibold text-[var(--ink-strong)]">下一步提示</dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--ink-body)]">
              {task.failure?.nextStep ?? task.nextStep}
            </dd>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              默认保留 {task.retentionDays} 天，且默认不用于模型训练。
            </p>
          </div>
        </dl>
      </section>

      {task.mode === "one-click" ? (
        <OneClickPanel
          taskId={task.taskId}
          onContinueRefine={() => setShowOneClickWorkbench(true)}
        />
      ) : null}

      {task.mode === "workbench" || showOneClickWorkbench ? (
        <TaskRiskWorkbench
          taskId={task.taskId}
          taskStatus={task.status}
          taskFailure={task.failure}
          mimeType={task.mimeType}
        />
      ) : null}

      <section className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
              删除当前任务
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-amber-950">
              删除将清理当前文档、任务记录与关联访问上下文
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              删除只针对当前任务，执行后不可撤回。成功后，该任务链接和页面内容都将不可继续访问。
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDeleteState({ kind: "confirm" })}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:ring-4 focus-visible:ring-rose-200"
          >
            删除当前任务
          </button>
        </div>

        {deleteState.kind === "confirm" || deleteState.kind === "submitting" ? (
          <div className="mt-5 rounded-3xl border border-amber-300 bg-white/80 p-5">
            <h3 className="text-lg font-semibold text-amber-950">删除确认</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
              <li>将删除当前上传文档及其关联的处理任务数据。</li>
              <li>浏览器中的当前任务访问上下文会被替换为已删除状态。</li>
              <li>该操作不可撤回，删除后不能继续查看此任务详情。</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={deleteState.kind === "submitting"}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-rose-200"
              >
                {deleteState.kind === "submitting" ? "删除中..." : "确认删除"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteState({ kind: "idle" })}
                disabled={deleteState.kind === "submitting"}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink-strong)] transition hover:bg-[var(--surface-accent)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
              >
                取消
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {deleteState.kind === "error" ? (
        <FailurePanel
          title={deleteState.title}
          detail={deleteState.detail}
          nextStep={deleteState.nextStep}
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <StageGuidanceCard
          title={stageGuidance.title}
          description={stageGuidance.description}
          items={stageGuidance.items}
        />
        <DataPolicyCard
          title="任务数据规则说明"
          items={policyItems}
          footer="任务详情页会明确展示默认保留期、访问边界、训练使用边界，以及当前任务的删除入口。"
        />
      </section>

      <FormatCapabilityCard
        title="当前任务可参考的格式能力边界"
        description="任务建立后，仍需持续说明不同格式的真实处理能力边界，避免用户误以为 PDF 已具备复杂排版精确回写。"
        entries={formatCapabilityMatrix}
      />

      {task.failure ? (
        <FailurePanel
          title={`${getTaskStageLabel(task.failure.stage)}阶段失败`}
          detail={task.failure.message}
          nextStep={task.failure.nextStep}
        />
      ) : null}
    </div>
  );
}
