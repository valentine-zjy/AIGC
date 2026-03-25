import type {
  TaskRiskHandlingStatus,
  TaskRiskIssueType,
  TaskRiskLevel,
  TaskRiskListData,
  TaskRiskSortMode,
  TaskSegmentConfidenceBucket,
  TaskSegmentContextStatus,
} from "@ai-rewrite/contracts";

export const riskLevelLabels: Record<TaskRiskLevel, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};

export const handlingStatusLabels: Record<TaskRiskHandlingStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  ignored: "Ignored",
};

export const issueTypeLabels: Record<TaskRiskIssueType, string> = {
  background_template: "Background template",
  method_boilerplate: "Method boilerplate",
  result_formula: "Result formula",
  conclusion_template: "Conclusion template",
};

export const sortModeLabels: Record<TaskRiskSortMode, string> = {
  recommended: "Recommended",
  score_desc: "Highest score",
  paragraph_asc: "Paragraph order",
};

export const segmentConfidenceLabels: Record<
  TaskSegmentConfidenceBucket,
  string
> = {
  high_confidence_issue: "High-confidence issue",
  optional_optimization: "Optional optimization",
};

export const segmentContextStatusLabels: Record<
  TaskSegmentContextStatus,
  string
> = {
  full: "Full context",
  limited: "Limited context",
};

export function findNextPendingParagraphId(
  result: TaskRiskListData,
  currentParagraphId: string | null,
) {
  return (
    result.items.find(
      (item) =>
        item.handlingStatus === "pending" &&
        item.paragraphId !== currentParagraphId,
    )?.paragraphId ?? null
  );
}

export function buildTaskRiskWorkbenchViewModel({
  result,
  selectedParagraphId,
}: {
  result: TaskRiskListData;
  selectedParagraphId: string | null;
}) {
  const selectedFinding =
    result.items.find((item) => item.paragraphId === selectedParagraphId) ??
    result.items[0] ??
    null;

  return {
    title:
      result.state === "pending"
        ? "Risk scan in progress"
        : result.items.length > 0
          ? "High-risk workbench"
          : "No matching risks",
    description: result.message,
    selectedFinding,
    selectedRiskLevelLabel: selectedFinding
      ? riskLevelLabels[selectedFinding.riskLevel]
      : null,
    selectedHandlingStatusLabel: selectedFinding
      ? handlingStatusLabels[selectedFinding.handlingStatus]
      : null,
    selectedIssueTypeLabel: selectedFinding
      ? issueTypeLabels[selectedFinding.issueType]
      : null,
    nextPendingParagraphId: findNextPendingParagraphId(
      result,
      selectedFinding?.paragraphId ?? null,
    ),
    currentSortModeLabel: sortModeLabels[result.filters.sortBy],
    totalLabel:
      result.totalCount > 0
        ? `${result.totalCount} matching paragraphs`
        : "No matching paragraphs",
  };
}