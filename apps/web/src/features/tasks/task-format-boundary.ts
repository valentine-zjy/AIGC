export type TaskFormatBoundaryState = "ready" | "pending" | "empty" | "failed";

export function isPdfMimeType(mimeType: string) {
  return mimeType === "application/pdf";
}

export function buildTaskFormatBoundaryNotice({
  mimeType,
  state,
}: {
  mimeType: string;
  state: TaskFormatBoundaryState;
}) {
  if (!isPdfMimeType(mimeType)) {
    return null;
  }

  switch (state) {
    case "pending":
      return {
        title: "PDF 只读扫描版",
        summary:
          "当前 PDF 任务仍在生成扫描结果。完成后你可以查看 Top 风险段落、问题类型和判定原因，但当前不承诺复杂版式下的精确回写。",
        nextStep:
          "继续等待当前扫描完成；如果后续识别不稳定，可重新上传更清晰的 PDF，或改用 Word / TXT 进入完整精修链路。",
      };
    case "empty":
      return {
        title: "PDF 只读扫描版",
        summary:
          "当前 PDF 已进入结果查看阶段，但没有可展示的高风险段落。PDF 的分页、版式和文本提取限制可能影响上下文呈现。",
        nextStep:
          "可以刷新结果、重新上传更清晰的 PDF，或改用 Word / TXT 获得更完整的后续编辑体验。",
      };
    case "failed":
      return {
        title: "PDF 只读扫描版",
        summary:
          "当前 PDF 任务未能成功完成扫描。MVP 仅承诺 PDF 的读取与结果查看路径，不承诺复杂版式下的稳定编辑回写。",
        nextStep:
          "建议重新上传更清晰的 PDF；如果你需要继续逐段精修和后续导出回写，优先改用 Word / TXT。",
      };
    case "ready":
      return {
        title: "PDF 只读扫描版",
        summary:
          "你现在可以查看 Top 风险段落、判定原因和文本化上下文，但当前仍不承诺复杂版式场景下的逐段原位替换或精确回写。",
        nextStep:
          "当前适合继续查看和分析；若要进入更完整的局部精修与导出链路，建议改用 Word / TXT。",
      };
  }
}
