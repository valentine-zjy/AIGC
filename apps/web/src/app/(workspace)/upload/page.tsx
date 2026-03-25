import Link from "next/link";
import { cookies } from "next/headers";

import { UploadForm } from "@/features/upload/UploadForm";
import { getUploadEntryState } from "@/features/upload/upload-entry-state";
import { uploadModeLabels } from "@/features/upload/upload-constraints";
import { getServerEnv } from "@/lib/env/server-env";
import {
  isBootstrapTaskContext,
  parseRequestedMode,
  parseStoredTaskContext,
  TASK_CONTEXT_COOKIE,
} from "@/task-session";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const requestedMode = parseRequestedMode(params.mode);
  const cookieStore = await cookies();
  const storedContext = parseStoredTaskContext(
    cookieStore.get(TASK_CONTEXT_COOKIE)?.value,
  );
  const entryState = getUploadEntryState({
    requestedMode,
    storedContext,
  });
  const { retentionDays } = getServerEnv();

  if (!entryState.hasTrustedContext || !entryState.activeMode) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 sm:px-8">
        <div className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-8 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            缺少可信上传上下文
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
            请先回到首页选择处理模式，再进入上传流程。
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--ink-body)]">
            仅依赖 <code>?mode=</code> 查询参数并不可信。当前页面只接受服务端签发的匿名任务上下文。
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-elevated)]"
          >
            返回模式选择
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 sm:px-8">
      <section className="rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-8 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          上传入口已就绪
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
          已为 {uploadModeLabels[entryState.activeMode]} 建立匿名任务上下文
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--ink-body)]">
          接下来会在当前页面完成文件校验、上传受理反馈和任务页跳转。格式能力、数据规则与当前阶段说明会固定展示在上传操作附近。
        </p>
      </section>

      <section className="mt-8">
        <UploadForm
          mode={entryState.activeMode}
          csrfToken={
            storedContext && isBootstrapTaskContext(storedContext)
              ? storedContext.csrfToken
              : ""
          }
          retentionDays={retentionDays}
        />
      </section>
    </main>
  );
}
