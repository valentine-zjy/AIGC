import assert from "node:assert/strict";

import {
  buildTaskFormatBoundaryNotice,
  isPdfMimeType,
} from "./task-format-boundary.ts";

assert.equal(isPdfMimeType("application/pdf"), true);
assert.equal(isPdfMimeType("text/plain"), false);

const readyNotice = buildTaskFormatBoundaryNotice({
  mimeType: "application/pdf",
  state: "ready",
});
assert.equal(readyNotice?.title, "PDF 只读扫描版");
assert.match(readyNotice?.summary ?? "", /查看 Top 风险段落/u);
assert.match(readyNotice?.nextStep ?? "", /Word \/ TXT/u);

const pendingNotice = buildTaskFormatBoundaryNotice({
  mimeType: "application/pdf",
  state: "pending",
});
assert.match(pendingNotice?.summary ?? "", /仍在生成扫描结果/u);
assert.match(pendingNotice?.nextStep ?? "", /更清晰的 PDF/u);

const failedNotice = buildTaskFormatBoundaryNotice({
  mimeType: "application/pdf",
  state: "failed",
});
assert.match(failedNotice?.summary ?? "", /未能成功完成扫描/u);
assert.match(failedNotice?.nextStep ?? "", /Word \/ TXT/u);

const nonPdfNotice = buildTaskFormatBoundaryNotice({
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  state: "ready",
});
assert.equal(nonPdfNotice, null);

console.log("task format boundary tests passed");
