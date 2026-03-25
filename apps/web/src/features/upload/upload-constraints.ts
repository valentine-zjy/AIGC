import type { ProcessingMode } from "@ai-rewrite/contracts";

import { formatCapabilityMatrix } from "../policies/format-capability-matrix.ts";

export const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = "20 MB";
export const ACCEPTED_UPLOAD_FILE_TYPES = ".doc,.docx,.pdf,.txt";

export const uploadModeLabels: Record<ProcessingMode, string> = {
  workbench: "工作台模式",
  "one-click": "一键模式",
};

export const uploadBoundaryNotes = [
  "上传后系统会先返回受理结果，再逐步进入解析、扫描与后续处理。",
  "Word / TXT 支持读取、扫描、局部精修与导出。",
  "PDF 当前只承诺读取与扫描结果查看，不承诺复杂版式的精确回写。",
];

export const uploadPrivacyNotes = [
  "原始文件、处理中间产物与导出结果进入受控私有存储，不长期保留在浏览器本地。",
  "任务访问绑定在服务端签发的匿名任务上下文中，而不是前端自行拼装的会话数据。",
  "失败时页面会继续说明数据是否安全、下一步怎么做，以及保留规则不会因此失效。",
];

export type SupportedUploadFormat = {
  extension: ".doc" | ".docx" | ".pdf" | ".txt";
  label: string;
  mimeTypes: readonly string[];
  boundary: string;
};

const wordBoundary =
  formatCapabilityMatrix.find((entry) => entry.id === "word")?.suitableFor ??
  "适合扫描、局部精修与导出回写。";
const pdfBoundary =
  formatCapabilityMatrix.find((entry) => entry.id === "pdf")?.suitableFor ??
  "适合先确认问题分布与扫描结果。";
const txtBoundary =
  formatCapabilityMatrix.find((entry) => entry.id === "txt")?.suitableFor ??
  "适合纯文本快速诊断、局部精修与导出。";

export const supportedUploadFormats: readonly SupportedUploadFormat[] = [
  {
    extension: ".doc",
    label: "Word (.doc)",
    mimeTypes: ["application/msword"],
    boundary: wordBoundary,
  },
  {
    extension: ".docx",
    label: "Word (.docx)",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    boundary: wordBoundary,
  },
  {
    extension: ".pdf",
    label: "PDF (.pdf)",
    mimeTypes: ["application/pdf"],
    boundary: pdfBoundary,
  },
  {
    extension: ".txt",
    label: "TXT (.txt)",
    mimeTypes: ["text/plain"],
    boundary: txtBoundary,
  },
] as const;

export function getUploadExtension(fileName: string): string | null {
  return fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? null;
}

export function getSupportedUploadFormat(fileName: string) {
  const extension = getUploadExtension(fileName);

  if (!extension) {
    return null;
  }

  return (
    supportedUploadFormats.find((format) => format.extension === extension) ??
    null
  );
}

export function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${Math.ceil(sizeInBytes / 1024)} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}