import { ModeEntryCard } from "@/components/shared/ModeEntryCard";
import {
  buildDataPolicyItems,
  sharedAccessScopeCopy,
} from "@/features/policies/data-governance-copy";
import { DataPolicyCard } from "@/features/policies/DataPolicyCard";
import { FormatCapabilityCard } from "@/features/policies/FormatCapabilityCard";
import { formatCapabilityMatrix } from "@/features/policies/format-capability-matrix";
import { modeOptions } from "@/features/entry/mode-options";
import { getServerEnv } from "@/lib/env/server-env";

const boundaryNotes = [
  "产品目标是降低模板感、增强作者感，帮助你在正式提交前先看清最该改的部分。",
  "MVP 优先覆盖桌面端连续工作流；移动端以轻量可访问为主，不承诺完整长文工作台体验。",
  "上传后会先返回受理结果，再逐步进入解析、扫描、优化与导出阶段。",
];

export function HomePage() {
  const { retentionDays } = getServerEnv();
  const policyItems = buildDataPolicyItems({
    retentionDays,
    accessScope: sharedAccessScopeCopy,
    trainingUse: "excluded",
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-16 pt-8 sm:px-8 lg:px-10">
      <a
        href="#mode-selection"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--accent-strong)] focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]"
      >
        跳到模式选择
      </a>

      <section className="grid gap-8 rounded-[2rem] border border-[var(--border-strong)] bg-[radial-gradient(circle_at_top_left,_rgba(92,126,163,0.16),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(239,245,249,0.96))] px-7 py-8 shadow-[var(--shadow-card)] lg:grid-cols-[1.4fr_0.9fr] lg:px-10 lg:py-10">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-muted)]">
            <span aria-hidden="true" className="text-base">
              场
            </span>
            正式提交前的诊断与精修工作台
          </div>

          <div className="space-y-4">
            <p className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight text-[var(--ink-strong)] sm:text-5xl">
              先告诉你哪里最该改，再让你用更可控的方式把文本修稳。
            </p>
            <p className="max-w-3xl text-lg leading-8 text-[var(--ink-body)]">
              AI 降重工具聚焦长文正式提交前的最后一轮处理。它先定位高风险段落，解释为什么像模板化表达，再给出局部建议与可回退的决策路径。
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-6">
          <h2 className="text-xl font-semibold text-[var(--ink-strong)]">使用边界</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-body)]">
            这里不是通用 AI 写作广场，也不是黑盒式整篇替换工具。首页先把产品定位、格式能力与数据规则讲清楚，避免高压场景下先上传、再猜系统能做什么。
          </p>

          <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--ink-body)]">
            {boundaryNotes.map((note) => (
              <li
                key={note}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-4"
              >
                {note}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <FormatCapabilityCard
          title="格式能力概览"
          description="上传前先确认不同格式的真实能力边界。Word / TXT 支持完整处理链路；PDF 当前以读取与扫描结果查看为主。"
          entries={formatCapabilityMatrix}
        />
        <DataPolicyCard
          title="数据规则说明"
          items={policyItems}
          footer="删除入口会固定出现在任务页附近。当前故事先说明范围、保留期与后果，不冒充已经具备真实删除动作。"
        />
      </section>

      <section className="mt-10 rounded-[2rem] border border-[var(--border-strong)] bg-[var(--surface-strong)] p-7 text-white shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/72">
          适用场景
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          长文正式提交前，需要先找到最值得改的部分。
        </h2>
        <p className="mt-4 text-sm leading-7 text-white/84">
          更适合论文、报告、正式文书等高压交付场景。产品默认围绕桌面端 Chrome / Edge 的连续工作流设计，让用户少跳转、少迷路、少丢上下文。
        </p>
      </section>

      <section id="mode-selection" className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              选择处理模式
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink-strong)]">
              从一个明确任务开始，而不是先面对复杂工具导航。
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[var(--ink-body)]">
            点击任一模式后，系统会建立匿名任务上下文并进入上传入口，为后续任务处理做好准备。
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          {modeOptions.map((option) => (
            <ModeEntryCard
              key={option.mode}
              {...option}
              icon={
                option.mode === "workbench" ? (
                  <span className="text-sm font-semibold">控</span>
                ) : (
                  <span className="text-sm font-semibold">快</span>
                )
              }
            />
          ))}
        </div>
      </section>
    </main>
  );
}
