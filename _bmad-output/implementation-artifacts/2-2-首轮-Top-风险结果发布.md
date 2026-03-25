# Story 2.2: 首轮 Top 风险结果发布

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 用户,
I want 在扫描完成后尽快拿到首轮 Top 高风险段落结果,
so that 我可以立刻开始处理最值得优先关注的问题。

## Acceptance Criteria

1. **Given** 文档扫描成功完成首轮分析  
   **When** 系统生成扫描结果  
   **Then** 系统返回按风险优先级排序的 Top 高风险段落列表  
   **And** 每条结果至少包含段落标识、风险等级、问题类型摘要和当前处理状态
2. **Given** 用户上传的是常见论文长度文档  
   **When** 系统资源处于常规负载范围  
   **Then** 系统应在 90 秒内返回首轮 Top 高风险段落结果  
   **And** 若文档更长，则在 5 分钟内返回首轮可操作结果并持续提供进度反馈
3. **Given** 首轮 Top 风险结果已生成  
   **When** 前端获取扫描结果  
   **Then** 客户端通过 TanStack Query 获取和缓存服务端结果  
   **And** 工作台可基于 Zustand 保存当前选中段落、筛选条件或面板状态而不影响结果一致性

## Tasks / Subtasks

- [x] 打通首轮 Top 风险结果的服务端事实数据链路，而不是只在前端拼占位列表（AC: 1, 2）
  - [x] 为风险结果补齐共享契约、存储模型与仓库边界，至少覆盖段落标识、风险等级、问题类型摘要、排序分值与处理状态。
  - [x] 在 worker 扫描完成后写入一批最小可用的首轮风险结果，并保证结果与任务状态解耦存储，避免把 findings 塞回 `processing_tasks` 单字段里。
  - [x] Story 2.2 只负责“首轮 Top 风险结果发布”，不要提前实现原因解释、原文定位面板、改写建议或导出逻辑。
- [x] 提供受保护的风险结果读取 API 与前端查询链路（AC: 1, 3）
  - [x] 新增 `GET /api/tasks/[taskId]/risks` 或等价边界，沿用任务上下文鉴权，不暴露跨任务读取能力。
  - [x] 使用 TanStack Query 获取和缓存风险结果，把服务端事实留在 Query，而不是复制成第二份前端真相。
  - [x] 若结果尚未生成，接口与前端必须返回清晰的空态或处理中态，不得伪造已完成列表。
- [x] 在当前任务页演进为首轮风险工作台入口，确保用户能看到 Top 风险结果并开始后续处理（AC: 1, 2, 3）
  - [x] 在任务详情页引入首轮风险列表区域，至少展示 Top 项、风险等级、问题类型摘要和当前处理状态。
  - [x] 引入最小 Zustand store 保存当前选中段落、筛选条件或面板状态，但不得把服务端 findings 本体搬进 store。
  - [x] 桌面端优先呈现“状态区 + 风险列表”结构；移动端可降级为摘要列表，但必须保留可读标签与空态说明。
- [x] 补齐 Story 2.2 自动化验证，覆盖结果写入、读取与基本工作台状态（AC: 1, 2, 3）
  - [x] 为 worker / repository / API 补充测试，验证扫描完成后能够读到已排序的 Top 风险结果。
  - [x] 为前端结果读取与状态保持补充测试，验证结果未生成、已生成、空列表三种分支不会回退成模糊状态。
  - [x] 维持仓库级 `npm test`、`npm run lint`、`npm run build` 通过。

## Dev Notes

### Story Intent & Boundaries

- Story 2.2 的目标是把“扫描完成 -> 产生首轮 Top 风险结果 -> 前台可读”这条链路做实。
- Story 2.2 不负责落地风险原因解释、原文上下文定位、局部改写建议、一键优化或导出能力；这些分别属于 Story 2.3+ 与 Epic 3/4。
- 当前 Story 2.1 已把任务阶段推进收口为 `upload -> parse -> scan`，因此 Story 2.2 应在 `scan` 完成后衔接 findings 生成与发布，而不是重新扩张状态机边界。

### Previous Story Intelligence

- Story 2.1 已建立真实 queue/worker/status write-back 链路，并明确 `rewrite/export` 仍是后续占位阶段。Story 2.2 不能回退这条边界。
- 当前任务详情页已经有状态轨道、短轮询、失败反馈与删除入口；新增风险结果区域时不能破坏这些已存在的访问边界与失败提示。
- 当前仓库尚未发现 `risk_findings`、`diagnosis` 或 `zustand` 实现文件，说明 Story 2.2 很可能需要从最小可用骨架开始补齐。

### Technical Requirements

- 风险结果至少应包含：段落标识、风险等级、问题类型摘要、排序分值、处理状态，以及与任务的关联。
- API 边界应遵循架构约束：`/api/tasks/[taskId]/risks`、REST/BFF、任务上下文鉴权、Zod 契约。
- 前端采用 `TanStack Query 5.87.4` 管服务端 findings，采用 `Zustand 5.0.10` 管当前选中段落、筛选条件或面板状态。
- Story 2.2 要优先发布“Top 风险列表”，不要把原因解释、建议比较器或编辑决策混进同一故事。

### Architecture Compliance

- 数据表目标已在架构中给出：`document_segments`、`risk_findings`。若当前故事做最小实现，也应沿着这条边界演进，而不是把 findings 永久塞回 `processing_tasks`。
- API 路径与 query key 目标已在架构中给出：`/api/tasks/[taskId]/risks` 与 `['task-risks', taskId, filters]`。
- 服务端真相优先放 TanStack Query，不复制到 Zustand 做第二份事实数据。

### Library / Framework Requirements

- 继续沿用当前锁定版本：`next 16.2.1`、`react 19.2.4`、`@tanstack/react-query 5.87.4`、`zod 4.1.5`、`drizzle-orm 0.44.5`、`BullMQ 5.58.5`。
- 若引入 Zustand，请显式补齐 workspace 依赖，并保持 store 只承载工作台跨面板 UI 状态。

### File Structure Requirements

- 优先复用 / 修改的文件
  - `apps/web/src/app/(workspace)/tasks/[taskId]/page.tsx`
  - `apps/web/src/app/api/tasks/[taskId]/route.ts`
  - `apps/web/src/features/tasks/task-service.ts`
  - `apps/web/src/features/tasks/task-detail-live-view.tsx`
  - `packages/contracts/src/api/task.schemas.ts`
  - `packages/db/src/task-repository.ts`
  - `apps/worker/src/jobs/ingest-document.job.ts`
- 预期新增的文件
  - `apps/web/src/app/api/tasks/[taskId]/risks/route.ts`
  - `apps/web/src/features/diagnosis/*`
  - `apps/web/src/features/tasks/task-risks-query.ts`
  - `apps/web/src/features/tasks/task-status-ui-store.ts`
  - `packages/db/src/schema/risk-findings.ts`
  - `packages/db/src/risks-repository.ts`
  - `packages/contracts/src/api/risk.schemas.ts`

### Testing Requirements

- 必做验证
  - 扫描完成后可读取按优先级排序的 Top 风险结果。
  - 风险结果接口受任务上下文保护，跨任务上下文不能读取他人 findings。
  - 前端对未生成、已生成、空列表三种状态都有清晰反馈。
  - 仓库级 `npm test`、`npm run lint`、`npm run build` 必须通过。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` -> `Epic 2` / `Story 2.2`]
- [Source: `_bmad-output/planning-artifacts/prd.md` -> `FR8`, `NFR3`, `NFR4`, `NFR6`]
- [Source: `_bmad-output/planning-artifacts/architecture.md` -> `risk_findings`, `/api/tasks/[taskId]/risks`, `TanStack Query 5.87.4`, `Zustand 5.0.10`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` -> `Journey 1`, `风险列表与筛选`, `Desktop Strategy`, `Accessibility Strategy`]
- [Source: `_bmad-output/implementation-artifacts/2-1-扫描任务编排与阶段状态写入.md`]

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `npm test`
- `npm run lint`
- `npm run build`

### Completion Notes List

- 已新增 `risk_findings` 契约、schema、repository 与 migration 校验，使风险结果脱离 `processing_tasks` 独立存储。
- 已让 worker 在 `scan` 完成后写入首轮 Top 风险结果，并在失败路径清理过期 findings，避免陈旧结果泄漏。
- 已新增受任务上下文保护的 `GET /api/tasks/[taskId]/risks`，并通过 TanStack Query + Zustand 在任务页落地首轮风险工作台。
- 已补齐 worker、API、筛选/状态与工作台视图测试，仓库级 `npm test`、`npm run lint`、`npm run build` 全部通过。
- 已按 code-review 风格自审本次改动，未发现新的阻塞性问题；额外收口了失败任务页风险轮询不停止的隐患。

### File List

- `apps/web/package.json`
- `apps/web/src/app/(workspace)/tasks/[taskId]/page.tsx`
- `apps/web/src/app/api/tasks/[taskId]/risks/route.ts`
- `apps/web/src/features/diagnosis/task-risk-workbench.tsx`
- `apps/web/src/features/diagnosis/task-risk-workbench-view-model.ts`
- `apps/web/src/features/tasks/task-detail-live-view.tsx`
- `apps/web/src/features/tasks/task-risks-query.ts`
- `apps/web/src/features/tasks/task-risks-service.ts`
- `apps/web/src/features/tasks/task-risks.test.mjs`
- `apps/web/src/features/tasks/task-status-copy.test.mjs`
- `apps/web/src/features/tasks/task-status-copy.ts`
- `apps/web/src/features/tasks/task-status-ui-store.ts`
- `apps/worker/src/jobs/ingest-document.job.ts`
- `apps/worker/src/worker.test.mjs`
- `package-lock.json`
- `packages/contracts/src/api/risk.schemas.ts`
- `packages/contracts/src/index.ts`
- `packages/db/migrations/0000_task_persistence.sql`
- `packages/db/scripts/verify-migration.mjs`
- `packages/db/src/index.ts`
- `packages/db/src/risks-repository.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/schema/risk-findings.ts`
- `packages/db/src/task-repository.ts`

## Change Log

- 2026-03-23: 创建 Story 2.2 实现上下文，明确首轮 Top 风险结果、风险读取 API、TanStack Query / Zustand 分工与工作台入口边界。
- 2026-03-23: 完成 Story 2.2 开发、自测与自审，落地首轮 Top 风险结果存储、受保护读取 API 与任务页风险工作台。