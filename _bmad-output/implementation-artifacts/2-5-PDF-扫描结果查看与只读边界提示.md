# Story 2.5: PDF 扫描结果查看与只读边界提示

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 用户,
I want 对上传的 PDF 文档完成扫描并查看高风险结果，同时明确理解当前只读边界,
so that 我可以在 PDF 场景下获得可用的风险诊断，而不会误以为系统已经支持复杂版式精确回写。

## Acceptance Criteria

1. **Given** 用户上传的是 PDF 文档  
   **When** 系统完成首轮扫描  
   **Then** 用户能够在工作台中查看该 PDF 的 Top 高风险段落结果、问题类型和判定原因  
   **And** 这些结果的展示方式与其他受支持格式保持基本一致的理解路径
2. **Given** 当前任务文档格式为 PDF  
   **When** 用户进入结果工作台或查看相关说明  
   **Then** 系统明确提示当前 MVP 对 PDF 提供扫描与结果查看能力  
   **And** 不承诺复杂版式场景下的精确回写、逐段原位替换或等价编辑体验
3. **Given** 用户在 PDF 结果页浏览高风险段落  
   **When** 系统展示段落内容与上下文  
   **Then** 页面提供足以支持风险理解和优先级判断的文本化信息  
   **And** 对因 PDF 版式、分页或提取限制导致的上下文偏差进行清晰说明
4. **Given** PDF 结果存在格式能力限制  
   **When** 用户尝试理解后续可执行动作  
   **Then** 系统通过清晰文本说明当前允许的查看、分析和后续处理边界  
   **And** 避免仅通过图标、颜色或隐含布局暗示这些限制
5. **Given** PDF 扫描结果尚未生成、生成失败或当前无可展示结果  
   **When** 页面渲染对应状态  
   **Then** 系统展示清晰的阶段反馈、失败提示或空态说明  
   **And** 给出下一步建议，例如继续等待、重新上传更清晰版本或改用更适合编辑回写的格式
6. **Given** 用户通过键盘或辅助技术浏览 PDF 结果  
   **When** 页面展示风险标签、处理状态和格式边界提示  
   **Then** 这些信息均对屏幕阅读器可理解并满足 WCAG 2.1 AA  
   **And** 状态和限制信息不只依赖颜色表达

## Tasks / Subtasks

- [x] 将 PDF 任务的结果工作台升级为“可扫描、可查看、只读边界清晰”的专用变体（AC: 1, 2, 3, 4）
  - [x] 在当前任务为 PDF 时，为工作台显示明确的格式边界提示，说明当前只支持扫描结果查看，不承诺复杂版式精确回写。
  - [x] 让 PDF 结果仍沿用 Story 2.3 / 2.4 的风险列表和诊断面板理解路径，但在文案上明确其为“PDF 只读版”或等价边界说明。
  - [x] 对 PDF 文本提取可能带来的分页、版式和上下文偏差提供可读解释，而不是让用户自行猜测。
- [x] 补齐 PDF 任务在不同状态下的边界反馈与下一步指引（AC: 2, 4, 5）
  - [x] 在结果待生成、失败、空态等场景下，如果当前文件为 PDF，则给出针对性的下一步提示，例如继续等待、重新上传更清晰 PDF，或改用 Word / TXT 进入完整精修链路。
  - [x] 不要暗示 PDF 已经支持逐段原位替换、精确导出回写或与 Word / TXT 等价的编辑体验。
- [x] 保持可访问性与格式边界的一致表达（AC: 4, 6）
  - [x] 所有 PDF 边界提示、只读说明和后续行动建议都必须以清晰文本呈现，不只依赖图标、颜色或布局位置。
  - [x] 诊断面板中的 PDF 限制说明应可被读屏器理解，并保持合理的标题和区域语义。
- [x] 补齐 Story 2.5 自动化验证，覆盖 PDF 边界文案与工作台状态回归（AC: 1, 2, 3, 4, 5, 6）
  - [x] 为 PDF 边界 helper / view model 增加只读提示与下一步建议测试。
  - [x] 维持仓库级 `npm test`、`npm run lint`、`npm run build` 通过。

## Dev Notes

### Story Intent & Boundaries

- Story 2.5 的重点不是新增 PDF 编辑能力，而是在现有扫描结果链路上把 PDF 的“只读边界”说清楚、展示清楚。
- Story 2.5 不负责复杂 PDF 段落映射、精确回写、导出修订版或原位替换；这些都超出当前 MVP。
- Story 2.5 也不负责局部建议采纳、忽略、误判、回退等 Epic 3 能力。

### Previous Story Intelligence

- Story 2.3 已落地风险列表与筛选排序工作台。
- Story 2.4 已落地段落诊断面板、原文上下文与置信提示读取链路。
- 上传页、格式能力卡和数据规则说明中已经多处声明“PDF 当前只承诺读取与扫描结果查看”，Story 2.5 要把这些边界延续到任务结果工作台内部。

### Technical Requirements

- 优先复用当前任务详情中的 `mimeType`、格式能力矩阵和工作台组件边界，不要为 Story 2.5 新增不必要的后端存储模型。
- 如果 PDF 与其他格式的差异只体现在展示与提示层，优先做前端视图模型 / helper 收敛，而不是扩展数据库结构。
- 在 PDF 场景下，诊断面板和结果状态文案应明确下一步：当前可继续查看风险与原因；若需要后续精修 / 导出回写，应改用 Word / TXT。

### Architecture Compliance

- 架构与 PRD 已明确 PDF 在 MVP 中先实现“读取与扫描”，不承诺复杂版式精确回写；Story 2.5 需要把这个边界体现到工作台而不是只停留在首页。
- 继续保持服务端事实数据在 Query、本地交互状态在 Zustand；本故事主要是视图层边界表达，不应引入新的双数据源。

### Library / Framework Requirements

- 延续当前锁定版本：`next 16.2.1`、`react 19.2.4`、`@tanstack/react-query 5.87.4`、`zustand 5.0.10`、`zod 4.1.5`。
- 优先使用纯函数 helper / view model 承载 PDF 边界文案，以便通过轻量测试覆盖。

### File Structure Requirements

- 优先复用 / 修改的文件
  - `apps/web/src/features/tasks/task-detail-live-view.tsx`
  - `apps/web/src/features/diagnosis/task-risk-workbench.tsx`
  - `apps/web/src/features/diagnosis/task-risk-workbench-view-model.ts`
  - `apps/web/src/features/policies/format-capability-matrix.ts`
- 预期新增 / 可能新增的文件
  - `apps/web/src/features/tasks/task-format-boundary.ts`
  - `apps/web/src/features/tasks/task-format-boundary.test.mjs`

### Testing Requirements

- 必做验证
  - PDF 任务进入工作台时展示明确的只读边界提示。
  - PDF 诊断面板说明中包含分页 / 版式 / 提取偏差提醒与下一步建议。
  - PDF 待生成、失败、空态等状态具有清晰文本说明，不只靠颜色。
  - 仓库级 `npm test`、`npm run lint`、`npm run build` 必须通过。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` -> `Epic 2` / `Story 2.5`]
- [Source: `_bmad-output/planning-artifacts/prd.md` -> `FR33`, `FR34`, `NFR28`, `MVP Boundary Decisions`, `Journey 2`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` -> `PDF 只读版`, `Warning Feedback`, `Accessibility Strategy`, `Responsive Development`]
- [Source: `_bmad-output/implementation-artifacts/2-4-段落诊断面板与原文上下文查看.md`]

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `npm test`
- `npm run lint`
- `npm run build`

### Completion Notes List

- 已新增 `task-format-boundary.ts` 与对应测试，将 PDF 的 ready / pending / empty / failed 四类只读边界文案统一收敛为纯函数 helper。
- 已让风险工作台在 PDF 场景下复用 Story 2.3 / 2.4 的列表与诊断路径，同时补齐“PDF 只读扫描版”提示、分页/版式/文本提取偏差说明与下一步建议。
- 已让任务详情页在 PDF 任务下延续相同边界表达，并修复删除确认区域残留的乱码文案，避免结果页说明失真。
- 已按 code-review 方式自审当前改动，未发现新的阻塞性问题；仓库级 `npm test`、`npm run lint`、`npm run build` 已全部通过。

### File List

- `apps/web/package.json`
- `apps/web/src/features/diagnosis/task-risk-workbench.tsx`
- `apps/web/src/features/tasks/task-detail-live-view.tsx`
- `apps/web/src/features/tasks/task-format-boundary.test.mjs`
- `apps/web/src/features/tasks/task-format-boundary.ts`

## Change Log

- 2026-03-24: 创建 Story 2.5 实现上下文，明确 PDF 扫描结果查看、只读边界提示与后续精修能力之间的职责分界。
- 2026-03-24: 完成 Story 2.5 开发、自测与自审，交付 PDF 只读扫描边界提示、状态分支说明与工作台文案回归。
