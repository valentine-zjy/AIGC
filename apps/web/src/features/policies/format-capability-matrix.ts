export type CapabilityState = "supported" | "limited" | "unsupported";

export type FormatCapabilityKey = "read" | "scan" | "edit" | "export";

export type FormatCapabilityEntry = {
  id: "word" | "pdf" | "txt";
  label: string;
  extensions: readonly string[];
  suitableFor: string;
  capabilities: Record<
    FormatCapabilityKey,
    {
      state: CapabilityState;
      label: string;
      description: string;
    }
  >;
};

export const formatCapabilityMatrix: readonly FormatCapabilityEntry[] = [
  {
    id: "word",
    label: "Word",
    extensions: [".doc", ".docx"],
    suitableFor: "适合扫描、局部精修与导出回写，是当前最完整的处理路径。",
    capabilities: {
      read: {
        state: "supported",
        label: "读取",
        description: "支持读取文档内容并进入任务流程。",
      },
      scan: {
        state: "supported",
        label: "扫描",
        description: "支持扫描高风险段落与表达问题。",
      },
      edit: {
        state: "supported",
        label: "局部精修",
        description: "支持在工作台中逐段查看建议并进行局部改写。",
      },
      export: {
        state: "supported",
        label: "导出",
        description: "支持导出处理结果，并保留正式提交前的人工复核空间。",
      },
    },
  },
  {
    id: "pdf",
    label: "PDF",
    extensions: [".pdf"],
    suitableFor: "适合先确认问题分布与扫描结果，不承诺复杂版式的精确回写。",
    capabilities: {
      read: {
        state: "supported",
        label: "读取",
        description: "支持读取 PDF 内容并进入扫描流程。",
      },
      scan: {
        state: "supported",
        label: "扫描",
        description: "支持查看扫描结果与问题分布。",
      },
      edit: {
        state: "limited",
        label: "局部精修",
        description: "当前不承诺复杂版式下的精确回写，建议以结果查看为主。",
      },
      export: {
        state: "limited",
        label: "导出",
        description: "当前不承诺复杂排版的精确导出回写。",
      },
    },
  },
  {
    id: "txt",
    label: "TXT",
    extensions: [".txt"],
    suitableFor: "适合纯文本快速诊断、局部精修与导出。",
    capabilities: {
      read: {
        state: "supported",
        label: "读取",
        description: "支持读取纯文本内容并直接进入处理。",
      },
      scan: {
        state: "supported",
        label: "扫描",
        description: "支持扫描高风险表达与结构问题。",
      },
      edit: {
        state: "supported",
        label: "局部精修",
        description: "支持逐段精修与人工复核。",
      },
      export: {
        state: "supported",
        label: "导出",
        description: "支持导出处理后的文本结果。",
      },
    },
  },
] as const;