import type { ProcessingMode } from "@ai-rewrite/contracts";

export type ModeOption = {
  mode: ProcessingMode;
  eyebrow: string;
  title: string;
  summary: string;
  benefit: string;
  riskNote: string;
  details: string[];
  actionLabel: string;
  variant: "primary" | "secondary";
};

export const modeOptions: ModeOption[] = [
  {
    mode: "workbench",
    eyebrow: "推荐起步",
    title: "工作台模式",
    summary:
      "先定位高风险段落，再理解成因、对比建议，最后决定哪些内容值得保留和精修。",
    benefit: "更适合正式提交前的人工把关，保留意义、语气和回退空间。",
    riskNote: "需要你参与更多判断，但可控性最高，适合长文终稿前的最后一轮处理。",
    details: [
      "适合论文、报告、正式文书等高压交付场景。",
      "模式确认后会进入上传、受理、扫描与后续逐段处理流程。",
      "支持 Word、TXT、PDF；其中 PDF 当前只承诺读取与扫描结果查看。",
    ],
    actionLabel: "进入工作台模式",
    variant: "primary",
  },
  {
    mode: "one-click",
    eyebrow: "快速预览",
    title: "一键模式",
    summary:
      "先生成整篇优化预览，再决定是否保留结果，或继续进入更细粒度的精修流程。",
    benefit: "适合先快速看整体改动面，判断是否值得继续投入详细处理。",
    riskNote: "范围更广，结果仍需人工复核，不承诺黑盒式整篇替换。",
    details: [
      "适合先看整体影响，再决定是否进入更细的工作台操作。",
      "后续仍会保留预览、精修与回退相关提示。",
      "Word / TXT 支持完整处理链路；PDF 当前以读取与扫描结果查看为主。",
    ],
    actionLabel: "尝试一键模式",
    variant: "secondary",
  },
];
