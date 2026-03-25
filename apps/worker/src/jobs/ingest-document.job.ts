import type {
  TaskFailureCode,
  TaskRiskHandlingStatus,
  TaskRiskIssueType,
  TaskRiskLevel,
  TaskSegmentConfidenceBucket,
  TaskSegmentContextStatus,
  TaskStage,
} from "@ai-rewrite/contracts";
import {
  getDocumentSegmentRepository,
  getRewriteOptionRepository,
  getRiskFindingRepository,
  getTaskRepository,
  type DocumentSegmentRepository,
  type RewriteOptionRepository,
  type RiskFindingRepository,
  type TaskRepository,
} from "@ai-rewrite/db";
import type { TaskJobPayload } from "@ai-rewrite/queue";

import { getWorkerEnv } from "../env.ts";

type SleepFn = (ms: number) => Promise<void>;
type WorkerProcessingStage = Extract<TaskStage, "parse" | "scan">;

type InitialRewriteOptionTemplate = {
  optionRank: number;
  title: string;
  strategyLabel: string;
  candidateText: string;
  rationale: string;
  diffSummary: string;
  isRecommended: boolean;
};

type InitialDiagnosisTemplate = {
  paragraphId: string;
  riskLevel: TaskRiskLevel;
  issueType: TaskRiskIssueType;
  issueTypeLabel: string;
  issueTypeSummary: string;
  excerpt: string;
  score: number;
  handlingStatus: TaskRiskHandlingStatus;
  originalText: string;
  previousContext: string | null;
  nextContext: string | null;
  diagnosisReason: string;
  confidenceBucket: TaskSegmentConfidenceBucket;
  confidenceLabel: string;
  confidenceSummary: string;
  contextStatus: TaskSegmentContextStatus;
  contextStatusLabel: string;
  rewriteOptions: InitialRewriteOptionTemplate[];
};

const stageLabels: Record<WorkerProcessingStage, string> = {
  parse: "解析",
  scan: "扫描",
};

const stagePlan: Array<{
  stage: WorkerProcessingStage;
  progressPercent: number;
  statusMessage: string;
  nextStep: string;
}> = [
  {
    stage: "parse",
    progressPercent: 30,
    statusMessage: "正在解析文档结构，准备进入扫描阶段。",
    nextStep: "保持当前页面打开，解析完成后系统会自动推进到扫描阶段。",
  },
  {
    stage: "scan",
    progressPercent: 78,
    statusMessage: "正在扫描高风险段落与表达问题，并生成局部改写建议。",
    nextStep:
      "扫描完成后会优先发布首轮 Top 风险结果、诊断信息和候选改写建议。",
  },
];

const failureCodeByStage: Record<WorkerProcessingStage, TaskFailureCode> = {
  parse: "parse_failed",
  scan: "scan_failed",
};

const initialDiagnosisTemplates: InitialDiagnosisTemplate[] = [
  {
    paragraphId: "p-003",
    riskLevel: "high",
    issueType: "background_template",
    issueTypeLabel: "背景套话",
    issueTypeSummary: "模板化研究背景句式过多",
    excerpt:
      "近年来，随着相关研究的不断深入，国内外学者围绕该问题展开了广泛讨论。",
    score: 97,
    handlingStatus: "pending",
    originalText:
      "近年来，随着相关研究的不断深入，国内外学者围绕该问题展开了广泛讨论，但多数研究仍停留在宏观描述层面，缺少对具体机制的细化分析。",
    previousContext:
      "上一段主要说明了研究议题的现实背景以及当前写作任务的时间压力。",
    nextContext:
      "下一段将继续说明本文准备聚焦的切入点，并收束到具体研究问题。",
    diagnosisReason:
      "这段以高度常见的研究背景起手，缺少与本文主题直接绑定的事实细节，容易呈现为模板化、可替换性较强的背景铺垫。",
    confidenceBucket: "high_confidence_issue",
    confidenceLabel: "高置信问题",
    confidenceSummary: "建议优先处理，这类背景套话会明显削弱作者感。",
    contextStatus: "full",
    contextStatusLabel: "上下文完整",
    rewriteOptions: [
      {
        optionRank: 1,
        title: "补足研究空缺与本文切口",
        strategyLabel: "强化问题绑定",
        candidateText:
          "现有研究虽然已围绕这一议题积累了不少讨论，但对于其中具体作用机制的解释仍较为粗略，这也构成了本文进一步展开分析的切入点。",
        rationale:
          "直接把背景陈述收束到“研究空缺 + 本文切口”，能减少空泛铺垫，提升作者自己的研究意图。",
        diffSummary:
          "弱化“近年来/国内外学者”套话，补入“具体作用机制仍较粗略”的问题定位。",
        isRecommended: true,
      },
      {
        optionRank: 2,
        title: "保留背景，但加入对象限定",
        strategyLabel: "增加具体约束",
        candidateText:
          "围绕这一议题的既有研究已经形成一定积累，但多数讨论仍停留在宏观层面，对于本文所关注对象的具体运行机制解释得还不够充分。",
        rationale:
          "保留原句的背景承接功能，同时通过“本文所关注对象”把句子拉回当前研究范围。",
        diffSummary:
          "保留背景综述语气，但补入“本文所关注对象”的限定。",
        isRecommended: false,
      },
      {
        optionRank: 3,
        title: "改成更直接的研究动机句",
        strategyLabel: "压缩背景铺垫",
        candidateText:
          "我更关注的是，这一议题虽然讨论很多，但真正解释清楚关键机制的研究并不多，因此有必要进一步细化分析。",
        rationale:
          "如果段落允许更直接的表达，这种写法能更明显地体现作者判断，而不是沿用常见综述模板。",
        diffSummary:
          "将背景综述改为更直接的研究动机陈述，作者立场更强。",
        isRecommended: false,
      },
    ],
  },
  {
    paragraphId: "p-011",
    riskLevel: "high",
    issueType: "method_boilerplate",
    issueTypeLabel: "方法套话",
    issueTypeSummary: "方法描述存在连续套话表达",
    excerpt:
      "本文采用文献分析、比较研究与案例归纳相结合的方法开展研究。",
    score: 91,
    handlingStatus: "pending",
    originalText:
      "本文采用文献分析、比较研究与案例归纳相结合的方法开展研究，并通过多维材料交叉验证结论的稳定性。",
    previousContext:
      "上一段交代了研究对象与研究范围，但尚未解释具体采用何种研究路径。",
    nextContext:
      "下一段将补充样本选择标准以及案例来源。",
    diagnosisReason:
      "方法描述使用了非常常见的论文模板句式，结构完整但个性不足，若不补充对象、路径和约束条件，容易让人感到像自动生成的通用方法说明。",
    confidenceBucket: "high_confidence_issue",
    confidenceLabel: "高置信问题",
    confidenceSummary: "建议优先处理，方法段的模板感通常会直接影响可信度。",
    contextStatus: "full",
    contextStatusLabel: "上下文完整",
    rewriteOptions: [
      {
        optionRank: 1,
        title: "把方法与材料来源绑定",
        strategyLabel: "补足执行路径",
        candidateText:
          "本文先梳理相关文献中的核心观点，再结合案例材料做横向比较，并据此归纳出几个可反复验证的分析维度。",
        rationale:
          "把“采用某某方法”改成“先做什么、再做什么”，能明显降低模板感，并让研究过程更可信。",
        diffSummary:
          "从抽象方法名改成连续动作链，读者更容易理解实际执行步骤。",
        isRecommended: true,
      },
      {
        optionRank: 2,
        title: "保留方法框架，突出验证逻辑",
        strategyLabel: "强化验证说明",
        candidateText:
          "研究过程中，我将文献梳理、案例比较与归纳分析结合起来使用，并通过不同来源材料的交叉比对来确认结论是否稳定。",
        rationale:
          "适合希望保留原有方法框架、但又想让“交叉验证”更自然的段落。",
        diffSummary:
          "保留原有方法组合，但把“交叉验证”解释为可理解的验证动作。",
        isRecommended: false,
      },
      {
        optionRank: 3,
        title: "突出研究对象与分析目的",
        strategyLabel: "连接对象与方法",
        candidateText:
          "围绕本文选取的案例对象，我分别从文献观点、案例差异和共性特征三个层面展开分析，以避免方法说明停留在概念罗列上。",
        rationale:
          "这一版更强调“为什么这样组合方法”，适合需要把研究对象拉回方法段的场景。",
        diffSummary:
          "将方法列表改成围绕案例对象展开的三层分析路径。",
        isRecommended: false,
      },
    ],
  },
  {
    paragraphId: "p-018",
    riskLevel: "medium",
    issueType: "result_formula",
    issueTypeLabel: "结果总结式表达",
    issueTypeSummary: "结果段首句重复使用总结性套话",
    excerpt:
      "综上可以看出，该策略在提升协同效率方面具有较为明显的积极作用。",
    score: 82,
    handlingStatus: "pending",
    originalText:
      "综上可以看出，该策略在提升协同效率方面具有较为明显的积极作用，但在资源协调成本上仍存在额外压力。",
    previousContext:
      "上一段列举了两个正向结果指标，并给出阶段性对比数据。",
    nextContext:
      "下一段准备转向讨论局限性与后续改进方向。",
    diagnosisReason:
      "该句提供了结果结论，但措辞高度概括，像是从常见结果总结模板直接替换名词而来，建议结合具体指标或对比对象增强真实性。",
    confidenceBucket: "optional_optimization",
    confidenceLabel: "可选优化项",
    confidenceSummary: "不是最强风险，但优化后能让论证更像真实作者表达。",
    contextStatus: "full",
    contextStatusLabel: "上下文完整",
    rewriteOptions: [
      {
        optionRank: 1,
        title: "把结论落到具体指标",
        strategyLabel: "引入结果依据",
        candidateText:
          "从前述对比结果看，这一策略确实提升了协同效率，但资源协调环节的额外成本并没有同步下降。",
        rationale:
          "用“前述对比结果”替代“综上可以看出”，能让结论显得更有依据，而不是套话式收束。",
        diffSummary:
          "去掉空泛的总结开头，直接把结论和前文结果绑定。",
        isRecommended: true,
      },
      {
        optionRank: 2,
        title: "保留转折，降低总结腔",
        strategyLabel: "弱化模板开头",
        candidateText:
          "这一策略在协同效率上的改善较为明显，不过它同时带来了更高的资源协调压力。",
        rationale:
          "适合想保留简洁结论句的场景，重点是去掉“综上可以看出”这类常见模板前缀。",
        diffSummary:
          "压缩总结前缀，保留“积极作用 + 成本压力”的双面信息。",
        isRecommended: false,
      },
      {
        optionRank: 3,
        title: "改成更审慎的结果表述",
        strategyLabel: "增强学术克制",
        candidateText:
          "现有结果更支持这样的判断：该策略有助于提升协同效率，但资源协调成本仍是不能忽视的附带代价。",
        rationale:
          "如果段落需要更克制的学术语气，这一版能保持判断力度，同时避免武断总结。",
        diffSummary:
          "从确定式总结改为“现有结果支持”的审慎表达。",
        isRecommended: false,
      },
    ],
  },
  {
    paragraphId: "p-024",
    riskLevel: "medium",
    issueType: "conclusion_template",
    issueTypeLabel: "结论模板化",
    issueTypeSummary: "结论收束语气过于模板化",
    excerpt:
      "总而言之，本文研究为后续相关领域的深化探索提供了有益参考。",
    score: 75,
    handlingStatus: "pending",
    originalText:
      "总而言之，本文研究为后续相关领域的深化探索提供了有益参考，同时也揭示了当前研究设计在样本覆盖上的局限。",
    previousContext: null,
    nextContext: "这是章节末尾的收束段，后面没有新的正文内容。",
    diagnosisReason:
      "结论段使用了非常典型的收束句式，能表达结束感，但缺少与本文独有贡献的绑定，因此更像通用结尾模板。",
    confidenceBucket: "optional_optimization",
    confidenceLabel: "可选优化项",
    confidenceSummary: "建议在有余力时处理，可通过补充本文独有发现来降低模板感。",
    contextStatus: "limited",
    contextStatusLabel: "上下文受限",
    rewriteOptions: [
      {
        optionRank: 1,
        title: "点出本文独有发现",
        strategyLabel: "收束到核心贡献",
        candidateText:
          "本文的讨论至少说明了一点：在样本覆盖仍有限的前提下，相关机制并不像既有研究中描述得那样稳定，这也是后续研究值得继续细化的地方。",
        rationale:
          "把结论收束到本文真正发现的内容，比“提供有益参考”这类通用结尾更具体。",
        diffSummary:
          "从泛泛而谈的结尾，改成“本文说明了什么 + 后续可怎么做”。",
        isRecommended: true,
      },
      {
        optionRank: 2,
        title: "保留局限说明，压缩套话",
        strategyLabel: "减少空泛收束",
        candidateText:
          "这项研究能够提供的启发，主要在于它揭示了样本覆盖不足时结论解释会受到怎样的限制。",
        rationale:
          "如果想保留结论段的稳妥语气，这一版能在压缩套话的同时保留局限讨论。",
        diffSummary:
          "删去“总而言之/有益参考”模板词，改成更具体的启发说明。",
        isRecommended: false,
      },
      {
        optionRank: 3,
        title: "强调后续研究方向",
        strategyLabel: "自然引出下一步",
        candidateText:
          "与其说本文给出了最终答案，不如说它进一步暴露了样本覆盖上的不足，这也为后续研究明确了需要继续补足的方向。",
        rationale:
          "适合需要把结论段自然过渡到未来研究方向的写法。",
        diffSummary:
          "将通用结尾替换为“当前不足 + 后续方向”的双层收束。",
        isRecommended: false,
      },
    ],
  },
];

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildInitialRiskFindings(taskId: string) {
  return initialDiagnosisTemplates.map((template, index) => ({
    findingId: `${taskId}-risk-${index + 1}`,
    paragraphId: template.paragraphId,
    riskLevel: template.riskLevel,
    issueType: template.issueType,
    issueTypeLabel: template.issueTypeLabel,
    issueTypeSummary: template.issueTypeSummary,
    excerpt: template.excerpt,
    score: template.score,
    handlingStatus: template.handlingStatus,
  }));
}

function buildInitialDocumentSegments(taskId: string) {
  return initialDiagnosisTemplates.map((template, index) => ({
    segmentId: `${taskId}-segment-${index + 1}`,
    paragraphId: template.paragraphId,
    originalText: template.originalText,
    previousContext: template.previousContext,
    nextContext: template.nextContext,
    diagnosisReason: template.diagnosisReason,
    confidenceBucket: template.confidenceBucket,
    confidenceLabel: template.confidenceLabel,
    confidenceSummary: template.confidenceSummary,
    contextStatus: template.contextStatus,
    contextStatusLabel: template.contextStatusLabel,
  }));
}

function buildInitialRewriteOptions(taskId: string) {
  return initialDiagnosisTemplates.flatMap((template) =>
    template.rewriteOptions.map((option) => ({
      optionId: `${taskId}-${template.paragraphId}-rewrite-${option.optionRank}`,
      paragraphId: template.paragraphId,
      optionRank: option.optionRank,
      title: option.title,
      strategyLabel: option.strategyLabel,
      candidateText: option.candidateText,
      rationale: option.rationale,
      diffSummary: option.diffSummary,
      isRecommended: option.isRecommended,
    })),
  );
}

export async function processTaskJob(
  payload: TaskJobPayload,
  {
    repository = getTaskRepository(),
    riskRepository = getRiskFindingRepository(),
    segmentRepository = getDocumentSegmentRepository(),
    rewriteRepository = getRewriteOptionRepository(),
    sleep = wait,
    stageDelayMs = getWorkerEnv().stageDelayMs,
    failAtStage,
  }: {
    repository?: TaskRepository;
    riskRepository?: RiskFindingRepository;
    segmentRepository?: DocumentSegmentRepository;
    rewriteRepository?: RewriteOptionRepository;
    sleep?: SleepFn;
    stageDelayMs?: number;
    failAtStage?: WorkerProcessingStage;
  } = {},
) {
  let currentStage: TaskStage = "upload";

  try {
    for (let index = 0; index < stagePlan.length; index += 1) {
      const step = stagePlan[index];
      currentStage = step.stage;

      const updated = await repository.updateTaskRecordState({
        taskId: payload.taskId,
        status: "processing",
        stage: step.stage,
        progressPercent: step.progressPercent,
        statusMessage: step.statusMessage,
        nextStep: step.nextStep,
        retryable: false,
      });

      if (!updated) {
        throw new Error(`Task ${payload.taskId} was not found while processing.`);
      }

      if (failAtStage === step.stage) {
        await riskRepository.deleteTaskRiskFindings(payload.taskId);
        await segmentRepository.deleteTaskDocumentSegments(payload.taskId);
        await rewriteRepository.deleteTaskRewriteOptions(payload.taskId);
        await repository.updateTaskRecordState({
          taskId: payload.taskId,
          status: "failed",
          stage: step.stage,
          progressPercent: step.progressPercent,
          statusMessage: `${stageLabels[step.stage]}阶段处理失败。`,
          nextStep:
            "当前文档仍按默认保留期保存。请稍后重新上传同一份文档；如果反复失败，请联系支持并提供任务编号。",
          retryable: true,
          failureCode: failureCodeByStage[step.stage],
          failureStage: step.stage,
          failureMessage: `处理在${stageLabels[step.stage]}阶段失败，当前文档仍安全保留，但尚未生成可继续使用的扫描结果。`,
        });

        return;
      }

      if (index < stagePlan.length - 1 && stageDelayMs > 0) {
        await sleep(stageDelayMs);
      }
    }

    await riskRepository.replaceTaskRiskFindings({
      taskId: payload.taskId,
      items: buildInitialRiskFindings(payload.taskId),
    });
    await segmentRepository.replaceTaskDocumentSegments({
      taskId: payload.taskId,
      items: buildInitialDocumentSegments(payload.taskId),
    });
    await rewriteRepository.replaceTaskRewriteOptions({
      taskId: payload.taskId,
      items: buildInitialRewriteOptions(payload.taskId),
    });

    await repository.updateTaskRecordState({
      taskId: payload.taskId,
      status: "completed",
      stage: "scan",
      progressPercent: 100,
      statusMessage:
        "上传、解析和扫描阶段已完成，首轮 Top 风险结果、诊断信息与候选改写建议已经可读。",
      nextStep:
        "你现在可以查看首轮 Top 风险列表，进入段落诊断面板，并对比 2-3 个局部改写建议。",
      retryable: false,
    });
  } catch (error) {
    await riskRepository.deleteTaskRiskFindings(payload.taskId);
    await segmentRepository.deleteTaskDocumentSegments(payload.taskId);
    await rewriteRepository.deleteTaskRewriteOptions(payload.taskId);
    await repository.updateTaskRecordState({
      taskId: payload.taskId,
      status: "failed",
      stage: currentStage,
      progressPercent: currentStage === "upload" ? 12 : 78,
      statusMessage: "Worker 在推进任务阶段时发生未预期错误。",
      nextStep:
        "当前文档仍按默认保留期保存。请稍后重新上传文档；如果问题持续，请联系支持并提供任务编号。",
      retryable: true,
      failureCode: "unexpected_worker_error",
      failureStage: currentStage,
      failureMessage:
        error instanceof Error ? error.message : "Unknown worker error",
    });

    throw error;
  }
}