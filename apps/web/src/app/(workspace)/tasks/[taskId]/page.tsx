import Link from "next/link";
import { cookies } from "next/headers";

import { AppProviders } from "@/app/providers";
import { TaskDetailLiveView } from "@/features/tasks/task-detail-live-view";
import { readAuthorizedTask } from "@/features/tasks/task-service";
import {
  isTaskAccessContext,
  parseStoredTaskContext,
  TASK_CONTEXT_COOKIE,
} from "@/task-session";

function getFailureTitle(code: string) {
  if (code === "task_deleted") {
    return "当前任务已删除";
  }

  if (code === "task_expired") {
    return "当前任务已超过保留期";
  }

  return "当前匿名上下文无法打开该任务";
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const cookieStore = await cookies();
  const storedContext = parseStoredTaskContext(
    cookieStore.get(TASK_CONTEXT_COOKIE)?.value,
  );
  const taskResult = await readAuthorizedTask({
    taskId,
    storedContext,
  });

  if (!("data" in taskResult)) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-6 py-10 sm:px-8">
        <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-8 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            任务访问边界
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
            {getFailureTitle(taskResult.error)}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-body)]">
            {taskResult.message}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {taskResult.nextStep}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-6 py-10 sm:px-8">
      <AppProviders>
        <TaskDetailLiveView
          initialTask={taskResult.data}
          taskCsrfToken={
            storedContext && isTaskAccessContext(storedContext)
              ? storedContext.csrfToken
              : null
          }
        />
      </AppProviders>
    </main>
  );
}