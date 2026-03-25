---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - C:\codex_workplace\AI降重工具\_bmad-output\planning-artifacts\prd.md
  - C:\codex_workplace\AI降重工具\_bmad-output\planning-artifacts\ux-design-specification.md
  - C:\codex_workplace\AI降重工具\_bmad-output\planning-artifacts\product-brief-AI降重工具-2026-03-20.md
  - C:\codex_workplace\AI降重工具\_bmad-output\planning-artifacts\research\market-多格式文档写作质量诊断与编辑工作台-research-2026-03-20.md
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-03-22'
project_name: 'AI降重工具'
user_name: 'Valentin'
date: '2026-03-22'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

当前 PRD 共定义 42 条功能需求，按架构含义可归纳为 7 组能力：

- 任务发起与接入：包括产品边界说明、格式支持说明、轻量启动任务、模式选择、文件上传、任务状态反馈、失败提示。
- 内容诊断与风险优先级：包括 Top 高风险段落排序、上下文定位、问题类型标注、原因解释、高置信与可选优化区分。
- 局部改写建议：包括单段 2-3 种建议、原文对照、单段应用、只改局部、不强制整篇替换。
- 护栏式一键优化与编辑控制：包括一键优化触发、结果预览、局部继续精修、接受/拒绝、单段撤销、整轮撤销。
- 反馈与决策支持：包括忽略建议、标记误判、查看处理状态、查看未处理高风险项、满意度反馈、“是否更敢交”反馈。
- 导出、数据处理与文档生命周期：包括导出 Word/TXT、仅导出已采纳修改、PDF 扫描支持、格式能力差异说明、数据规则说明、删除请求。
- 内部运营与质量恢复：包括任务阶段状态、失败原因、重试、最小必要样本查看、重复问题识别、规则停用或调整。

从架构角度看，这意味着系统不是单次文本生成接口，而是一个“上传 -> 解析 -> 扫描 -> 建议 -> 采纳/回退 -> 导出”的状态化工作流产品。核心复杂度不在页面数量，而在任务编排、文档结构映射、编辑状态一致性和结果可恢复性。

**Non-Functional Requirements:**

当前 PRD 共定义 32 条非功能需求，主要分为 5 组：

- 性能：首屏 2 秒可交互；上传后 3 秒内受理反馈；2 万-5 万字文档 90 秒内返回首轮结果；5 万-10 万字以上文档 5 分钟内返回首轮可操作结果，并持续反馈进度。
- 安全与隐私：默认不用于训练；传输与静态存储加密；最小必要访问；7 天默认保留；支持显式删除。
- 可靠性：不能静默失败；各阶段状态必须清晰；导出可重试；已采纳修改可恢复；一键优化必须可逆。
- 无障碍：WCAG 2.1 AA；全键盘操作；清晰焦点；非颜色单独传递状态；关键动态状态可被读屏理解。
- 可扩展性：早期支持约 50-200 个常规任务；高峰期承受 3-5 倍压力并可见排队/降级；扩容不应破坏核心工作流。

这些 NFR 会直接塑造后续架构。对这个产品来说，隐私边界、任务透明度、导出稳定性、回退能力与无障碍支持，都是一等架构约束，而不是后补优化项。

**Scale & Complexity:**

综合 PRD 与 UX 规格，这个项目更接近“中高复杂度的文档处理工作台”，而不是低复杂度 SaaS 表单应用。

- Primary domain: 桌面优先的全栈 Web 应用，核心是异步文档处理与编辑工作台
- Complexity level: Medium-High
- Estimated architectural components: 9-12 个核心组件/服务边界

复杂度上升的主要来源有：

- 多格式文档导入、段落切分、定位映射和导出保真
- 长任务异步处理与分阶段状态跟踪
- 工作台内高密度状态管理，包括原文、建议、已采纳、已拒绝、已忽略、已回退
- 护栏式一键优化与局部精修并存
- 以“更敢交”为目标的高可靠、高可解释体验要求
- 最小可用内部运营与质量恢复能力

### Technical Constraints & Dependencies

当前文档明确给出的技术约束与依赖包括：

- 产品形态已确定为桌面优先 SPA，桌面 Chromium 浏览器（Chrome / Edge）为 MVP 主支持环境。
- 核心价值建立在连续工作台交互之上，因此需要单页内稳定承载风险列表、段落诊断、建议比较、采纳回退和导出流程。
- MVP 不做多人实时协作，不做开放 API，不做复杂账户体系，不做学校系统或外部平台集成。
- Word / TXT 是优先支持的完整链路格式；PDF 在 MVP 中先做读取与扫描，不承诺复杂版式的精确回写。
- 系统需要支持 2 万字到 10 万字以上长文档，因此必须采用异步任务处理与渐进反馈，而不能依赖同步阻塞式请求。
- UX 上已确定工作台是高状态密度界面，桌面端需要承载多区域并行查看，移动端只承担能力收缩后的轻量路径。
- 产品必须满足 WCAG 2.1 AA 基线，这会影响组件库、状态表达、焦点管理和动态更新机制。
- 产品当前由单人推进，因此架构需要控制实现复杂度，优先保证最短闭环可落地与可运维。

### Cross-Cutting Concerns Identified

以下是已经明确会跨越多个模块的横切关注点：

- 异步任务编排与状态追踪：上传、解析、扫描、建议生成、优化、导出都需要统一任务模型和状态机。
- 文档结构映射与导出保真：风险段落、原文位置、修改建议、已采纳结果之间必须保持稳定映射，尤其要兼顾 Word/TXT 优先与 PDF 能力边界。
- 版本安全与回退机制：局部采纳、一键优化、误改恢复、导出前确认都要求稳定的变更记录与恢复路径。
- 隐私与数据生命周期：默认不训练、7 天保留、显式删除、最小必要访问、静态与传输加密需要贯穿数据流。
- 无障碍与状态可感知性：风险等级、任务进度、建议强弱、成功/失败状态都不能只依赖视觉颜色表达。
- 可观测性与最小运营后台：单人运营仍需要看到阶段状态、失败原因、重试入口和重复问题模式。
- 峰值承载与降级策略：论文提交高峰场景下，系统需要优先保证可受理、可排队、可反馈，而不是硬失败。
- 信任与可解释性：不是只有模型输出质量，解释先行、边界说明、建议强弱提示、结果可控性都会影响最终用户是否“更敢交”。

## Starter Template Evaluation

### Primary Technology Domain

`Full-stack web application with a SPA-like workbench shell`

原因是这个产品虽然明确要求桌面优先 SPA 体验，但它并不是一个只有浏览器内状态的纯前端工具。上传文档、任务状态跟踪、异步扫描、导出、内部排障与后续工作流都要求我们从一开始就以“全栈 Web 产品”来选基础，而不是只选一个纯前端脚手架。

同时，核心工作台又必须保留 SPA 式的连续交互和强状态体验，因此更准确的表述是：以全栈 Web 为主域，但前端交互形态应接近 SPA 工作台。

### Starter Options Considered

**1. Next.js 官方 `create-next-app`**

- 当前官方文档的最新版本为 `16.2.1`。
- 官方文档明确说明 Next.js 可以完整支持 SPA，并且可以先作为严格 SPA 起步，再按需要逐步加入服务端能力。
- 默认脚手架已经覆盖 TypeScript、Tailwind、ESLint、App Router、Turbopack 和 `AGENTS.md`。
- 对本项目的适配点在于：可以用同一套框架同时承载官网 SEO 页面和登录后的工作台壳层，并为后续上传接口、任务查询接口和 BFF 层预留自然位置。
- 风险在于：它不是“最轻”的纯 SPA 起点，App Router 的服务端/客户端边界也会带来一定认知负担。

**2. React Router Framework 官方 `create-react-router`**

- 当前官方文档显示最新分支为 `7.13.1`。
- 官方基础模板可直接创建项目，也有官方维护的可部署模板，覆盖 Node + Docker、Custom Express Server、Node + Postgres 等路径。
- 这个方案对本项目的优势是：同样能做全栈或静态部署，保留 React 路由与工作台交互的清晰心智，也支持 SPA 模式。
- 风险在于：它更像一个“你自己掌控更多细节”的框架型起点，对单人 MVP 来说，早期需要自己补齐的工程决策会比官方 Next.js 起步更多。

**3. Vite 官方 `create-vite`（React TypeScript 模板）**

- 当前官方主线是 `Vite 7`。
- 官方模板支持 `react-ts` 和 `react-swc-ts`，并且默认浏览器目标已经提升到适合现代 Chrome / Edge 的基线。
- 这个方案最贴合“纯 SPA 工作台”心智，开发反馈也很快。
- 但它的问题是：它只很好地解决了前端壳层，而没有同时为官网 SEO、上传接口、任务查询、导出与最小后台能力提供统一起点。对这个产品来说，过早把前后端完全拆开，会让单人开发阶段承担更多系统边界成本。

**4. Create T3 App**

- 当前可见最新 release 为 `7.40.0`。
- 它本质上是一个围绕 Next.js + TypeScript 的强类型全栈 CLI，常见组合会引入 Tailwind、tRPC、Prisma、NextAuth 等。
- 它适合“我已经确认要走较完整 TypeScript 全栈组合”的项目。
- 但对当前 MVP 来说，它比我们需要的更重，也更容易过早绑定到 auth / ORM / RPC 方案；而这个产品当前最重要的是先把文档工作台、异步任务链路与导出闭环做稳。

### Selected Starter: Next.js 官方 `create-next-app`

**Rationale for Selection:**

在当前约束下，我建议使用 Next.js 官方 starter 作为起点，原因有四个：

1. 它最符合“`工作台像 SPA，但产品整体是全栈 Web`”这个项目现实。官方文档已经明确支持 SPA 形态，这解决了它是否违背 SPA 要求的问题。
2. 它能在一个起点里同时承载官网 SEO 页面和登录后的客户端工作台，减少单人开发初期的系统分裂。
3. 它的默认脚手架已经把 TypeScript、App Router、Tailwind、Turbopack、ESLint 等基础决策收拢好了，能明显减少前期样板选择成本。
4. 对这个产品最关键的异步文档处理、任务状态和导出流程来说，Next.js starter 不会限制我们后续把重处理链路拆到独立 worker/service；它更像是一个稳定的 Web 壳层与 BFF 起点。

如果后续你决定把“官网”和“工作台”彻底拆开，或者明确要走“前端 SPA + 独立 Python/Node API”双仓路线，那么 Vite 或 React Router Framework 会重新变得更有吸引力。但按当前 MVP 和单人推进节奏，我认为官方 Next 起手最稳。

**Initialization Command:**

```bash
npx create-next-app@latest <app-name> --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --empty --yes
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**

- 默认使用 TypeScript
- 以当前 Next.js `16.2.1` 主线为基础
- Node.js 最低要求为 `20.9+`

**Styling Solution:**

- 默认采用 Tailwind CSS
- 适合后续基于 CSS variables 和 design tokens 建立可主题化设计系统

**Build Tooling:**

- 默认启用 Turbopack
- 使用 Next.js 官方构建链路与 App Router 能力

**Testing Framework:**

- 官方 starter 默认不直接预置测试框架
- Next.js 官方文档单独提供 Cypress、Jest、Playwright、Vitest 指南
- 这意味着测试选型仍可在后续架构决策中独立完成

**Code Organization:**

- 使用 App Router
- 使用 `src/` 目录结构
- 默认 import alias 为 `@/*`
- 可自然演进为：营销页、工作台页、任务状态接口、内部运营页面共存的一体化代码组织

**Development Experience:**

- 默认具备本地开发服务器与热更新体验
- 默认带 ESLint 配置
- 默认可包含 `AGENTS.md`
- 适合单人开发先快速起盘，再逐步加上更明确的后端工作流和基础设施

**Note:** 项目初始化命令应作为第一条实现故事来执行；异步任务 worker、文档处理服务、存储与队列不应在 starter 阶段一次性硬绑死。

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- 采用 `Managed PostgreSQL 17.x` 作为主业务数据库兼容基线。
- 采用 `Drizzle ORM 0.44.5` + `drizzle-kit 0.31.4` 作为数据访问与迁移方案。
- 采用“`Postgres 存结构化数据 + 私有对象存储存文件二进制`”的双层持久化模型。
- MVP 不强制用户登录，采用“`匿名任务会话 + 任务级访问令牌`”模式。
- 采用 `REST/BFF` 风格的 Next.js Route Handlers，而不是 GraphQL / tRPC。
- 采用 `BullMQ 5.58.5` + Redis-compatible queue 处理异步文档流水线。
- 前端采用 `TanStack Query 5.87.4` 管服务端状态，`Zustand 5.0.10` 管工作台跨面板状态。
- 部署形态采用“`Vercel 跑 Next.js Web/BFF + Render Background Worker 跑长任务`”。

**Important Decisions (Shape Architecture):**

- 采用 `Zod 4.1.5` 作为前后端共享验证边界。
- 文件对象存储采用 `Cloudflare R2` 私有桶，承载原始上传、处理中间产物和导出结果。
- 表单层采用 `React Hook Form 7.62.0` + Zod。
- 可观测性采用 `@sentry/nextjs 10.8.0` + 结构化日志。
- MVP 不引入通用读缓存；Redis 只用于队列、限流计数和短期幂等窗口。
- 内部运营后台采用 founder-only 的 allowlist 密码less 登录模式，具体认证库实现可延后到后台真正落地时再定。

**Deferred Decisions (Post-MVP):**

- 完整用户账户体系与跨设备历史
- 多角色 / 多租户 RBAC
- GraphQL / tRPC
- SSE / WebSocket 实时状态流
- 通用查询缓存层
- 向量检索 / 跨文档风格记忆
- 对外开放 API

### Data Architecture

**Primary Database:**

- 选择 `Managed PostgreSQL 17.x` 作为实现基线。
- 理由：文档任务、段落、风险项、候选改写、采纳记录、导出记录、删除生命周期都天然更适合关系模型；同时 17.x 比追逐 18.x 更容易对接当前常见托管环境。

**ORM & Migrations:**

- ORM: `Drizzle ORM 0.44.5`
- Migration tool: `drizzle-kit 0.31.4`
- Rationale: 对单人开发更轻、更接近 SQL、本地迁移文件清晰，便于后续 AI agent 在 schema 和 query 上保持一致。

**Validation Strategy:**

- 统一采用 `Zod 4.1.5`
- 所有上传元数据、任务请求、任务状态响应、后台操作输入、导出参数都经过同一套 schema 校验。
- 前后端共享 schema，减少工作台状态与接口契约漂移。

**Persistence Split:**

- PostgreSQL 存：
  - task / stage / retry / failure 元数据
  - document logical model
  - segment 映射
  - risk findings
  - rewrite candidates
  - accepted edits
  - export jobs
  - deletion / retention audit
- Object storage 存：
  - 原始上传文件
  - 规范化文本快照
  - 导出文件
  - 解析中间产物

**Data Modeling Approach:**

- 采用“`规范化关系模型 + 附加式编辑事件`”方案。
- 关键实体建议包括：
  - `documents`
  - `document_assets`
  - `processing_tasks`
  - `document_segments`
  - `risk_findings`
  - `rewrite_options`
  - `edit_operations`
  - `exports`
  - `deletion_requests`
- `edit_operations` 采用 append-only 思路，避免直接覆盖原始内容，天然支持回退、导出筛选和问题排查。

**Caching Strategy:**

- MVP 不上通用查询缓存。
- 依赖数据库索引、任务分页和对象存储分离先把基础性能做稳。
- Redis 不作为事实数据源，只用于：
  - queue state
  - upload / task creation rate limit counters
  - idempotency windows
  - 短期 task progress fan-out

### Authentication & Security

**End-User Authentication:**

- MVP 不要求用户先注册登录。
- 采用“`匿名任务会话 + HttpOnly cookie + task-scoped opaque token`”模式。
- 理由：符合“轻量启动任务”的 FR，同时避免一开始就引入复杂账户系统拖慢闭环验证。

**Authorization Pattern:**

- 授权粒度以“任务”为中心，而不是以用户组织和角色为中心。
- 只有持有当前任务访问上下文的请求，才能读取对应任务状态、风险项和导出结果。
- 后续如果加账号体系，再把任务归属挂到用户身份上。

**Internal Operations Access:**

- 内部运营页采用 founder-only allowlist 模式。
- 交互形态建议为密码less magic link 或同等级低摩擦方式。
- 具体认证库实现延后，但模式先固定：`单人后台 != 完整多角色后台`。

**Security Middleware & Controls:**

- 上传入口执行：
  - MIME / 扩展名双校验
  - 文件大小限制
  - 病毒扫描预留挂点
  - 请求频控
- 所有 cookie-bound mutation 使用 CSRF 防护。
- 所有下载链接采用短时效签名访问。
- 所有后台操作写审计日志。

**Encryption Approach:**

- 传输层：TLS
- 静态存储：依赖托管数据库、对象存储、Redis 的 at-rest encryption
- 应用层：浏览器永不直接持久保存原文全文；前端只持有当前工作所需规范化片段与状态

### API & Communication Patterns

**API Style:**

- 选择 `REST/BFF`，以 Next.js Route Handlers 为主。
- 不采用 GraphQL / tRPC 作为 MVP 主协议。
- 理由：文件上传、长任务、导出、后台排障、显式状态机都更适合资源型接口。

**Transport Patterns:**

- 上传：`multipart/form-data`
- 工作台数据：`JSON`
- 文件下载：签名 URL / 受控下载接口
- 任务进度：MVP 先用短轮询，不直接上 SSE / WebSocket

**Service Communication:**

- Web 应用负责：
  - 接收上传
  - 创建任务
  - 提供状态查询
  - 提供工作台读写接口
- Worker 负责：
  - 解析文档
  - 切分段落
  - 生成诊断
  - 生成候选改写
  - 产出导出文件
- Web 与 Worker 之间通过：
  - Queue job payload
  - PostgreSQL task state
  - Object storage object keys
 进行协作，而不是直接传大文本二进制。

**Error Handling Standard:**

- 统一响应信封：
  - `code`
  - `stage`
  - `message`
  - `retryable`
  - `taskId`
- 用户端优先显示阶段化错误，如：上传失败、解析失败、扫描失败、导出失败。
- 后台记录机器可读错误码与上下文。

**Rate Limiting Strategy:**

- 对上传、任务创建、导出触发做 IP + session 粒度限流。
- 对后台接口做更严格的 allowlist + limit。
- 计数器放在 Redis-compatible store。

**API Documentation Approach:**

- MVP 不单独维护 public API portal。
- 以 Zod schema + repo 内契约文档作为事实来源。
- 如果后续开放 API，再从现有 schema 派生 OpenAPI。

### Frontend Architecture

**State Management:**

- Server state: `TanStack Query 5.87.4`
- Workbench cross-panel client state: `Zustand 5.0.10`
- Local transient UI state: React local state
- Shareable filter / selection state: URL search params

**Why this split:**

- 任务状态、风险列表、导出状态这类服务端真相交给 Query。
- “当前选中段落、对比中的建议、局部 accept/reject/rollback 状态”交给 Zustand。
- 避免把所有东西都堆进单一全局 store。

**Component Architecture:**

- 三层结构：
  - design-system primitives
  - workbench composites
  - flow-specific containers
- 工作台核心组件围绕：
  - risk list
  - diagnosis panel
  - rewrite comparator
  - decision bar
  - processing rail
构建。

**Routing Strategy:**

- App Router 承载：
  - 营销页
  - 文档上传入口
  - 工作台页
  - 导出确认页
  - 内部运营页
- 工作台页本身是“server-rendered shell + client-heavy interaction island”。

**Performance Strategy:**

- 风险列表和长结果集使用 virtualization。
- PDF 预览、diff viewer 等重组件按需动态加载。
- 浏览器不做全量文档解析，只消费服务端规范化后的段落数据。
- 局部 accept/reject/rollback 先做本地即时反馈，再异步持久化。

**Forms & Validation:**

- 小型表单统一采用 `React Hook Form 7.62.0` + Zod。
- 不把工作台主编辑状态强行做成“大表单”。

### Infrastructure & Deployment

**Web Hosting:**

- `Vercel` 承载 Next.js Web/BFF 与官网。
- 理由：对 Next.js 16.x 路径最顺手，官网 SEO 与工作台壳层同仓更省力。

**Background Processing:**

- `Render Background Worker` 承载长任务 worker。
- 理由：文档解析、候选生成、导出都不适合塞进短生命周期 Web request；Render 官方文档也直接把 BullMQ 列为 Node worker 常见方案。

**Queue & Async Orchestration:**

- 采用 `BullMQ 5.58.5`
- Redis 作为 queue backend
- 如果使用 Upstash Redis，采用 fixed plan，而不是 pay-as-you-go
- 理由：BullMQ 正好覆盖 retries、progress、concurrency、queue events、job dedupe 等本产品关键需求

**Object Storage:**

- 采用 `Cloudflare R2` 私有桶
- 理由：S3-compatible，Web 与 Worker 都容易接入，且官方明确强调无 egress fee，更适合文档上传/下载型产品

**Monitoring & Logging:**

- 前端 / BFF：`@sentry/nextjs 10.8.0`
- Worker：统一接入 Sentry + structured JSON logs
- 所有 task stage 变更都写入结构化日志，便于单人排障

**CI/CD:**

- GitHub Actions 负责 lint / typecheck / test / build
- `main` 分支通过后触发 Vercel / Render 部署
- 预览环境至少覆盖 Web 层，worker 采用 staging queue / storage / db 隔离

**Scaling Strategy:**

- 以 queue backlog 作为系统节流与降级控制中心
- 高峰期优先保证：
  - 上传受理
  - 状态可见
  - 扫描最终可达
- 可按阶段限制并发：
  - parse concurrency
  - diagnosis concurrency
  - rewrite concurrency
  - export concurrency
- 当队列过深时，优先降级：
  - PDF 复杂回写
  - 一键优化并发
  - 非关键后台统计任务

### Decision Impact Analysis

**Implementation Sequence:**

1. 初始化 Next.js 基础工程与设计系统壳层
2. 搭建 PostgreSQL / Drizzle / Zod 基础数据层
3. 接入私有对象存储与上传入口
4. 建立 BullMQ 队列与 worker skeleton
5. 建立 task state API 与前端轮询闭环
6. 实现文档 segment / risk / rewrite / edit-operation 数据模型
7. 实现工作台 accept / reject / rollback
8. 实现导出流水线
9. 接入内部运营最小排障页
10. 接入 Sentry 与结构化日志

**Cross-Component Dependencies:**

- 上传成功后必须同时创建：
  - object storage asset
  - database document record
  - processing task
  - queue job
- Worker 产出的所有中间结果都必须回写 Postgres，而不是只停留在内存或 Redis。
- 前端工作台只读取规范化后的段落与候选数据，不直接依赖原始文档二进制。
- 导出结果依赖：
  - source snapshot
  - accepted edit operations
  - export task status
- 删除请求必须扇出到：
  - database
  - object storage
  - queue artifacts / logs retention policy

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
共识别出 12 类容易导致多 AI agent 产出不兼容代码的冲突点，集中在命名、目录结构、接口格式、状态管理、事件命名、错误处理和长任务流程表达上。

### Naming Patterns

**Database Naming Conventions:**

- 表名统一使用 `snake_case` + 复数形式，例如：`documents`、`processing_tasks`、`risk_findings`
- 主键统一为 `id`
- 外键统一为 `{resource}_id`，例如：`document_id`、`task_id`
- 时间列统一为：
  - `created_at`
  - `updated_at`
  - `deleted_at`（仅软删场景）
- 状态列统一使用 `status`
- 枚举值统一使用小写 `snake_case`，例如：`queued`、`needs_review`
- 索引命名：
  - 普通索引：`idx_{table}__{column_list}`
  - 唯一索引：`uq_{table}__{column_list}`
- 示例：
  - `idx_processing_tasks__document_id_status`
  - `uq_document_assets__storage_key`

**API Naming Conventions:**

- 路由路径统一使用小写复数资源名，例如：
  - `/api/tasks`
  - `/api/documents/[documentId]`
  - `/api/tasks/[taskId]/risks`
- URL 参数在代码中统一用 `camelCase`，例如：`taskId`、`documentId`
- 查询参数统一使用 `camelCase`，例如：`pageSize`、`riskLevel`
- Header 仅在确有必要时自定义，自定义 header 使用 kebab-case，例如：`x-task-token`
- 不使用动词式 endpoint，如 `/api/getTasks`
- 动作型子资源统一写成资源后缀，例如：
  - `/api/tasks/[taskId]/retry`
  - `/api/exports/[exportId]/download`

**Code Naming Conventions:**

- React 组件名：`PascalCase`
- React 组件文件名：`PascalCase.tsx`
- hooks：`useXxx.ts`
- 普通 TypeScript 模块文件：`kebab-case.ts`
- 变量 / 函数 / 参数：`camelCase`
- 常量：`SCREAMING_SNAKE_CASE`
- Zod schema 命名：
  - 输入：`createTaskInputSchema`
  - 输出：`taskResponseSchema`
- Store 命名：
  - `useWorkbenchStore`
  - `useTaskFiltersStore`
- Route segment 目录使用 Next.js 约定文件名，业务目录使用 `kebab-case`

### Structure Patterns

**Project Organization:**

- 采用“按业务能力分层 + 按 feature 聚合”的结构
- `app/` 只放路由入口、页面壳层、route handlers，不堆业务逻辑
- `features/` 放业务能力，例如：
  - `upload`
  - `tasks`
  - `diagnosis`
  - `rewrites`
  - `exports`
  - `ops`
- `components/ui/` 放通用设计系统原子组件
- `components/shared/` 放跨 feature 可复用组合组件
- `lib/` 放跨域基础设施能力，例如：
  - db
  - queue
  - storage
  - auth
  - logger
- `server/` 放明确服务端专属逻辑时使用，避免和客户端混放

**File Structure Patterns:**

- 单元测试 / 组件测试与源文件 co-located，命名为 `*.test.ts(x)`
- E2E 测试统一放在根级 `tests/e2e/`
- 文档契约或示例数据统一放在 feature 内 `__fixtures__/`
- 静态资源放 `public/`
- 不把 SQL、schema、API handler、UI 组件混在同一目录
- 所有环境变量定义统一在单一 schema 文件中校验，不允许散落读取

### Format Patterns

**API Response Formats:**

- 成功响应统一：

```json
{
  "data": {},
  "error": null,
  "meta": {}
}
```

- 失败响应统一：

```json
{
  "data": null,
  "error": {
    "code": "PARSE_FAILED",
    "message": "文档解析失败",
    "retryable": true,
    "stage": "parsing"
  },
  "meta": {
    "requestId": "req_xxx",
    "taskId": "task_xxx"
  }
}
```

- 列表响应统一放在 `data.items`
- 分页信息统一放在 `meta.pagination`
- 不返回裸数组或裸字符串作为正式接口响应

**Data Exchange Formats:**

- API JSON 字段统一使用 `camelCase`
- 数据库字段统一使用 `snake_case`
- 时间统一使用 ISO 8601 UTC 字符串，例如：`2026-03-22T10:30:00.000Z`
- 布尔值统一使用 `true/false`
- 空值统一使用 `null`，不混用 `undefined`
- ID 统一使用字符串，不在 API 层暴露自增整数语义
- 枚举统一使用稳定字符串字面量，不传数字码表

### Communication Patterns

**Event System Patterns:**

- 异步事件命名统一采用 `domain.action`，例如：
  - `task.created`
  - `document.parsed`
  - `risk.generated`
  - `rewrite.accepted`
  - `export.failed`
- 事件载荷统一结构：

```json
{
  "eventId": "evt_xxx",
  "eventName": "task.created",
  "occurredAt": "2026-03-22T10:30:00.000Z",
  "payloadVersion": 1,
  "taskId": "task_xxx",
  "documentId": "doc_xxx",
  "payload": {}
}
```

- 事件名不用 `PascalCase`
- payload version 必须显式声明，便于后续演进

**State Management Patterns:**

- 服务端真相优先放 TanStack Query，不复制到 Zustand 做第二份事实数据
- Zustand 只保存：
  - 当前选中段落
  - 当前比较建议
  - 本地未提交 UI 决策
  - 面板开合状态
- Query key 统一采用数组格式，例如：
  - `['task', taskId]`
  - `['task-risks', taskId, filters]`
- Store action 统一用动词开头：
  - `selectSegment`
  - `acceptRewrite`
  - `rollbackEdit`
- 所有状态更新采用不可变更新，不做隐式共享可变对象

### Process Patterns

**Error Handling Patterns:**

- 区分 3 层错误：
  - 用户可理解错误
  - 可重试业务错误
  - 内部诊断错误
- 用户提示文案不暴露底层堆栈
- 日志必须记录机器可读错误码
- 每个长任务阶段都必须有明确失败状态，不允许“卡住但无状态变化”
- React 页面级异常用 error boundary，异步任务异常用任务状态面板承载，不混用
- 所有 mutation 都必须返回成功或失败的明确结果，不允许 silent fail

**Loading State Patterns:**

- 短请求状态统一为：
  - `idle`
  - `pending`
  - `success`
  - `error`
- 长任务阶段状态统一为：
  - `queued`
  - `uploading`
  - `parsing`
  - `diagnosing`
  - `rewriting`
  - `exporting`
  - `completed`
  - `failed`
- 页面级 loading 只用于首屏骨架
- 面板级 loading 只影响当前区域，不阻塞整个工作台
- 所有长任务都要显示当前阶段，而不是只有 spinner
- 重试按钮只出现在 `retryable=true` 的场景

### Enforcement Guidelines

**All AI Agents MUST:**

- 所有输入输出边界都通过 Zod schema 定义和校验。
- 所有正式接口都遵循统一响应信封，不得各自返回自定义格式。
- 所有数据库命名使用 `snake_case`，所有 API / TypeScript 命名使用 `camelCase` 或 `PascalCase` 约定。
- 所有长任务阶段都写入标准状态，不允许跳过状态记录。
- 所有编辑修改都通过 append-only `edit_operations` 思路表达，不直接覆盖原文事实记录。
- 所有 feature 代码优先落在对应 feature 目录，不把业务逻辑塞进 `app/` 页面文件。
- 所有错误都必须区分用户提示与内部日志。

**Pattern Enforcement:**

- 新增接口时必须同时提交：
  - Zod schema
  - 响应样例
  - 错误码
- 新增数据表时必须遵循命名规则并附 migration
- PR / agent 输出检查清单至少覆盖：
  - 命名是否一致
  - 响应格式是否一致
  - 状态枚举是否复用
  - 错误码是否复用或扩展得当
- 发现模式冲突时，以 architecture 文档规则为准，不以局部实现习惯为准

### Pattern Examples

**Good Examples:**

- 数据表：`processing_tasks`
- 字段：`document_id`
- API 路径：`/api/tasks/[taskId]/risks`
- Query key：`['task-risks', taskId, filters]`
- 组件文件：`RiskParagraphCard.tsx`
- Hook 文件：`useTaskPolling.ts`
- 工具模块：`task-status.ts`
- 事件名：`document.parsed`
- 错误码：`EXPORT_GENERATION_FAILED`

**Anti-Patterns:**

- 表名写成 `ProcessingTasks` 或 `task`
- API 返回有时是 `{result: ...}`，有时是 `{data: ...}`
- 一个 agent 用 `user_id`，另一个 agent 用 `userId` 存数据库列
- 把服务端查询结果整份复制进 Zustand 作为第二数据源
- 页面里直接写数据库查询和业务编排
- 长任务失败后前端只显示“出错了”，没有 `stage` 和 `retryable`
- 同一类状态一会儿叫 `in_progress`，一会儿叫 `processing`

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
ai-rewrite-workbench/
├── README.md
├── AGENTS.md
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── .gitignore
├── .npmrc
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-preview.yml
├── scripts/
│   ├── bootstrap.mjs
│   ├── verify-env.mjs
│   ├── run-worker-dev.mjs
│   └── seed-demo-data.mjs
├── docs/
│   ├── api-contracts.md
│   ├── error-codes.md
│   ├── task-lifecycle.md
│   └── ops-runbook.md
├── tests/
│   ├── e2e/
│   │   ├── upload-and-scan.spec.ts
│   │   ├── local-rewrite-flow.spec.ts
│   │   ├── one-click-optimize.spec.ts
│   │   ├── export-flow.spec.ts
│   │   └── ops-task-retry.spec.ts
│   ├── fixtures/
│   │   ├── thesis-short.docx
│   │   ├── thesis-long.docx
│   │   ├── sample.txt
│   │   └── sample.pdf
│   └── helpers/
│       ├── upload-file.ts
│       └── assert-task-status.ts
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── postcss.config.js
│   │   ├── eslint.config.js
│   │   ├── tsconfig.json
│   │   ├── middleware.ts
│   │   ├── public/
│   │   │   ├── icons/
│   │   │   ├── illustrations/
│   │   │   └── demo/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── globals.css
│   │       │   ├── layout.tsx
│   │       │   ├── (marketing)/
│   │       │   │   ├── page.tsx
│   │       │   │   ├── privacy/page.tsx
│   │       │   │   ├── terms/page.tsx
│   │       │   │   └── help/page.tsx
│   │       │   ├── (workspace)/
│   │       │   │   ├── upload/page.tsx
│   │       │   │   ├── tasks/[taskId]/page.tsx
│   │       │   │   ├── tasks/[taskId]/loading.tsx
│   │       │   │   ├── tasks/[taskId]/error.tsx
│   │       │   │   ├── exports/[exportId]/page.tsx
│   │       │   │   └── deleted/page.tsx
│   │       │   ├── (ops)/
│   │       │   │   ├── ops/login/page.tsx
│   │       │   │   ├── ops/tasks/page.tsx
│   │       │   │   └── ops/tasks/[taskId]/page.tsx
│   │       │   └── api/
│   │       │       ├── uploads/route.ts
│   │       │       ├── tasks/route.ts
│   │       │       ├── tasks/[taskId]/route.ts
│   │       │       ├── tasks/[taskId]/risks/route.ts
│   │       │       ├── tasks/[taskId]/segments/route.ts
│   │       │       ├── tasks/[taskId]/rewrite-options/route.ts
│   │       │       ├── tasks/[taskId]/edit-operations/route.ts
│   │       │       ├── tasks/[taskId]/retry/route.ts
│   │       │       ├── tasks/[taskId]/feedback/route.ts
│   │       │       ├── exports/route.ts
│   │       │       ├── exports/[exportId]/download/route.ts
│   │       │       ├── documents/[documentId]/delete/route.ts
│   │       │       └── ops/
│   │       │           ├── auth/request-link/route.ts
│   │       │           ├── auth/verify/route.ts
│   │       │           ├── tasks/route.ts
│   │       │           └── tasks/[taskId]/retry/route.ts
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   │   ├── button.tsx
│   │       │   │   ├── badge.tsx
│   │       │   │   ├── dialog.tsx
│   │       │   │   ├── progress.tsx
│   │       │   │   └── tooltip.tsx
│   │       │   └── shared/
│   │       │       ├── AppHeader.tsx
│   │       │       ├── EmptyState.tsx
│   │       │       ├── ErrorState.tsx
│   │       │       └── LoadingSkeleton.tsx
│   │       ├── features/
│   │       │   ├── upload/
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   ├── schemas/
│   │       │   │   └── utils/
│   │       │   ├── tasks/
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   ├── stores/
│   │       │   │   └── selectors/
│   │       │   ├── diagnosis/
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── utils/
│   │       │   ├── rewrites/
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   ├── stores/
│   │       │   │   └── utils/
│   │       │   ├── exports/
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── utils/
│   │       │   ├── feedback/
│   │       │   │   ├── components/
│   │       │   │   └── hooks/
│   │       │   └── ops/
│   │       │       ├── components/
│   │       │       ├── hooks/
│   │       │       └── utils/
│   │       ├── lib/
│   │       │   ├── api/
│   │       │   │   ├── client.ts
│   │       │   │   ├── response.ts
│   │       │   │   └── error-map.ts
│   │       │   ├── auth/
│   │       │   │   ├── task-session.ts
│   │       │   │   ├── task-token.ts
│   │       │   │   └── ops-session.ts
│   │       │   ├── env/
│   │       │   │   ├── client.ts
│   │       │   │   └── server.ts
│   │       │   ├── query/
│   │       │   │   ├── query-client.ts
│   │       │   │   └── query-keys.ts
│   │       │   ├── logging/
│   │       │   │   ├── browser-logger.ts
│   │       │   │   └── server-logger.ts
│   │       │   └── utils/
│   │       │       ├── dates.ts
│   │       │       ├── cn.ts
│   │       │       └── task-status.ts
│   │       └── types/
│   │           └── ui.ts
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts
│           ├── env.ts
│           ├── queues/
│           │   ├── task-queue.ts
│           │   ├── worker-events.ts
│           │   └── job-names.ts
│           ├── jobs/
│           │   ├── ingest-document.job.ts
│           │   ├── parse-document.job.ts
│           │   ├── diagnose-document.job.ts
│           │   ├── generate-rewrites.job.ts
│           │   ├── optimize-document.job.ts
│           │   ├── export-document.job.ts
│           │   └── delete-document.job.ts
│           ├── services/
│           │   ├── task-runner.ts
│           │   ├── task-progress.ts
│           │   ├── failure-recovery.ts
│           │   └── idempotency.ts
│           └── adapters/
│               ├── llm/
│               │   ├── llm-client.ts
│               │   └── prompt-builders/
│               ├── parsers/
│               │   ├── docx-parser.ts
│               │   ├── txt-parser.ts
│               │   └── pdf-parser.ts
│               └── exporters/
│                   ├── docx-exporter.ts
│                   └── txt-exporter.ts
├── packages/
│   ├── contracts/
│   │   ├── package.json
│   │   └── src/
│   │       ├── api/
│   │       │   ├── task.schemas.ts
│   │       │   ├── risk.schemas.ts
│   │       │   ├── rewrite.schemas.ts
│   │       │   ├── export.schemas.ts
│   │       │   └── ops.schemas.ts
│   │       ├── db/
│   │       │   ├── enums.ts
│   │       │   └── identifiers.ts
│   │       └── events/
│   │           └── task-events.ts
│   ├── db/
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   ├── migrations/
│   │   └── src/
│   │       ├── client.ts
│   │       ├── schema/
│   │       │   ├── documents.ts
│   │       │   ├── document-assets.ts
│   │       │   ├── processing-tasks.ts
│   │       │   ├── document-segments.ts
│   │       │   ├── risk-findings.ts
│   │       │   ├── rewrite-options.ts
│   │       │   ├── edit-operations.ts
│   │       │   ├── exports.ts
│   │       │   └── deletion-requests.ts
│   │       ├── repositories/
│   │       │   ├── documents-repository.ts
│   │       │   ├── tasks-repository.ts
│   │       │   ├── risks-repository.ts
│   │       │   ├── rewrites-repository.ts
│   │       │   └── exports-repository.ts
│   │       └── transactions/
│   │           └── create-task-transaction.ts
│   ├── queue/
│   │   ├── package.json
│   │   └── src/
│   │       ├── client.ts
│   │       ├── queues.ts
│   │       ├── enqueue-task.ts
│   │       └── retry-policy.ts
│   ├── storage/
│   │   ├── package.json
│   │   └── src/
│   │       ├── r2-client.ts
│   │       ├── object-keys.ts
│   │       ├── upload-object.ts
│   │       ├── get-signed-download-url.ts
│   │       └── delete-object.ts
│   ├── document-pipeline/
│   │   ├── package.json
│   │   └── src/
│   │       ├── normalize/
│   │       │   ├── normalize-document.ts
│   │       │   └── segment-document.ts
│   │       ├── diagnosis/
│   │       │   ├── score-risk.ts
│   │       │   ├── explain-risk.ts
│   │       │   └── rank-findings.ts
│   │       ├── rewrites/
│   │       │   ├── build-local-options.ts
│   │       │   ├── build-one-click-plan.ts
│   │       │   └── validate-rewrite-safety.ts
│   │       ├── exports/
│   │       │   ├── apply-edit-operations.ts
│   │       │   └── build-export-artifact.ts
│   │       └── shared/
│   │           ├── stage-machine.ts
│   │           └── content-hash.ts
│   ├── observability/
│   │   ├── package.json
│   │   └── src/
│   │       ├── sentry.ts
│   │       ├── logger.ts
│   │       └── metrics.ts
│   └── config/
│       ├── package.json
│       └── src/
│           ├── eslint/
│           ├── typescript/
│           └── tailwind/
└── .bmad-output/
```

### Architectural Boundaries

**API Boundaries:**

- `apps/web/src/app/api/uploads` 只负责上传受理、校验、入库、入队，不做文档重处理。
- `apps/web/src/app/api/tasks/*` 只暴露任务与工作台读写接口，不直接调用模型或解析器。
- `apps/web/src/app/api/ops/*` 只服务内部运营路径，必须经过 founder-only ops session。
- `apps/worker` 不暴露公网 HTTP API，只消费队列和持久化结果。

**Component Boundaries:**

- `app/` 是路由和页面壳层边界。
- `features/` 是业务 UI 和交互边界。
- `components/ui/` 不能依赖 feature 逻辑。
- `features/*` 可以依赖 `components/ui/`、`components/shared/`、`packages/contracts`，但不能直接跨 feature 偷用内部 store。
- 工作台核心状态分界：
  - 服务端事实状态在 Query
  - 本地交互状态在 feature store
  - 页面级布局状态在 route container

**Service Boundaries:**

- `packages/db` 是唯一数据库访问边界。
- `packages/storage` 是唯一对象存储访问边界。
- `packages/queue` 是唯一入队/取队边界。
- `packages/document-pipeline` 是唯一文档规范化、诊断、改写规划、导出拼装边界。
- `apps/worker/adapters/llm` 是模型供应商适配边界，避免把供应商调用散落到业务代码中。

**Data Boundaries:**

- 原始文件和导出产物只进对象存储，不进数据库。
- 结构化事实只进 Postgres，不进 Redis。
- Redis 只承载 queue / rate limit / 短期幂等。
- 浏览器只消费规范化段落、风险、建议和状态，不直接持有完整原始文档事实。

### Requirements to Structure Mapping

**FR Category Mapping:**

- 产品接入与任务发起
  - `apps/web/src/app/(marketing)/`
  - `apps/web/src/app/(workspace)/upload/`
  - `apps/web/src/app/api/uploads/`
  - `apps/web/src/features/upload/`

- 内容诊断与风险优先级
  - `apps/web/src/app/api/tasks/[taskId]/risks/`
  - `apps/web/src/features/diagnosis/`
  - `packages/document-pipeline/src/diagnosis/`
  - `packages/db/src/schema/risk-findings.ts`

- 局部改写建议
  - `apps/web/src/app/api/tasks/[taskId]/rewrite-options/`
  - `apps/web/src/features/rewrites/`
  - `packages/document-pipeline/src/rewrites/`
  - `packages/db/src/schema/rewrite-options.ts`

- 护栏式一键优化与编辑控制
  - `apps/web/src/features/rewrites/`
  - `apps/web/src/app/api/tasks/[taskId]/edit-operations/`
  - `packages/db/src/schema/edit-operations.ts`
  - `packages/document-pipeline/src/rewrites/build-one-click-plan.ts`

- 反馈与结果确认
  - `apps/web/src/features/feedback/`
  - `apps/web/src/app/api/tasks/[taskId]/feedback/`

- 导出与文档生命周期
  - `apps/web/src/features/exports/`
  - `apps/web/src/app/api/exports/`
  - `apps/worker/src/jobs/export-document.job.ts`
  - `apps/worker/src/jobs/delete-document.job.ts`
  - `packages/storage/`
  - `packages/db/src/schema/exports.ts`
  - `packages/db/src/schema/deletion-requests.ts`

- 内部运营与质量恢复
  - `apps/web/src/app/(ops)/`
  - `apps/web/src/app/api/ops/`
  - `apps/web/src/features/ops/`
  - `apps/worker/src/services/failure-recovery.ts`

**Cross-Cutting Concerns:**

- 鉴权与任务访问：`apps/web/src/lib/auth/`
- 环境变量与配置：`apps/web/src/lib/env/`, `apps/worker/src/env.ts`, `packages/config/`
- 契约与 schema：`packages/contracts/`
- 观测与日志：`packages/observability/`
- 错误码与响应包装：`apps/web/src/lib/api/`

### Integration Points

**Internal Communication:**

- Web 创建任务后，通过 `packages/queue` 入队。
- Worker 消费 job 后，通过 `packages/db` 回写阶段状态，通过 `packages/storage` 读写文件产物。
- Web 工作台通过 `packages/contracts` 约束 API 响应，使用轮询读取任务状态。
- 所有编辑接受/拒绝/回退都先写 `edit_operations`，再由导出任务汇总成最终文件。

**External Integrations:**

- 对象存储：`packages/storage/`
- Redis / BullMQ：`packages/queue/`
- LLM provider：`apps/worker/src/adapters/llm/`
- Sentry：`packages/observability/`
- 部署平台：
  - Web -> Vercel
  - Worker -> Render

**Data Flow:**

1. 用户上传文件到 Web。
2. Web 做校验、存对象存储、创建 document/task 记录、入队。
3. Worker 解析并规范化文档，写回 segments / risks / rewrite options。
4. 用户在工作台读取结果并写入 `edit_operations`。
5. 导出任务读取 source snapshot + accepted edit operations，生成导出文件。
6. 删除请求触发数据库与对象存储双侧清理。

### File Organization Patterns

**Configuration Files:**

- 根目录放 workspace 与 CI 配置。
- `apps/web` 放 Next.js 专属配置。
- `packages/db` 放 Drizzle 配置与 migrations。
- 所有 env 示例统一在根级 `.env.example`，实际读取在各 app 的 env schema 中完成。

**Source Organization:**

- UI 代码只在 `apps/web`
- 长任务代码只在 `apps/worker`
- 跨 app 共享逻辑只进入 `packages/*`
- 不允许在 `apps/web` 直接复制一份 worker 流水线逻辑

**Test Organization:**

- 源文件旁边 colocated unit tests
- 根级 `tests/e2e` 跑跨流程验证
- `tests/fixtures` 统一承载文档样本
- worker job 集成测试优先放在对应 package 或 job 目录旁

**Asset Organization:**

- 公共营销素材在 `apps/web/public`
- 用户上传和导出文件不进 git，不进 `public`
- 测试文件样本与真实运行文件严格分离

### Development Workflow Integration

**Development Server Structure:**

- 本地开发默认同时启动：
  - `apps/web`
  - `apps/worker`
  - Postgres
  - Redis
- Web 与 worker 共用 contracts/db/queue/storage packages

**Build Process Structure:**

- Web build 只打包 `apps/web`
- Worker build 只打包 `apps/worker`
- packages 作为 workspace 依赖被各自消费
- CI 先检查 shared packages，再检查 app 层

**Deployment Structure:**

- 单仓库，多 deploy target
- `apps/web` 部署到 Vercel
- `apps/worker` 部署到 Render
- `packages/*` 不独立部署，只作为内部共享模块

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

当前技术决策整体兼容，没有发现明显互相打架的选择：

- `Next.js 16.2.1` 作为 Web/BFF 壳层，与“SPA 式工作台 + 官网 SEO”的双重目标一致。
- `PostgreSQL 17.x` + `Drizzle ORM 0.44.5` + `Zod 4.1.5` 形成了清晰的数据、迁移与契约组合，适合单人开发和后续 AI agent 协作。
- `BullMQ 5.58.5` + Redis-compatible queue 与“长任务异步处理、可重试、可见进度、阶段状态机”高度匹配。
- `TanStack Query 5.87.4` + `Zustand 5.0.10` 的前端分工清晰，能承接工作台的高状态密度交互。
- `Vercel + Render Background Worker + Cloudflare R2` 的部署拆分也与“Web 短请求 + Worker 长处理 + 文件对象存储”模型一致。

唯一需要明确说明的是：当前架构把“模型供应商选择”刻意隔离在 `apps/worker/src/adapters/llm/`，这是有意保留，不构成阻塞性缺口。

**Pattern Consistency:**

实现模式与架构决策基本一致：

- 数据库采用 `snake_case`，API / TypeScript 采用 `camelCase` / `PascalCase`，命名边界清楚。
- API 响应信封、错误结构、任务阶段状态、事件命名规则都与异步任务产品特征吻合。
- `app/`、`features/`、`packages/*` 的边界与 monorepo 结构是统一的，没有前后矛盾。
- “服务端事实状态进 Query，本地交互状态进 Zustand”的规则与工作台结构一致，能避免双数据源漂移。

**Structure Alignment:**

目录结构对前面所有关键决策都有承接能力：

- `apps/web` 能承载官网、工作台、ops 页和 Route Handlers。
- `apps/worker` 能独立承载解析、诊断、改写、导出、删除任务。
- `packages/contracts`、`packages/db`、`packages/queue`、`packages/storage`、`packages/document-pipeline` 的拆分与既定服务边界一致。
- requirements 到目录的映射已经足够具体，可以直接指导 story 拆解与实现落点。

### Requirements Coverage Validation ✅

**Feature Coverage:**

PRD 中 7 类功能需求都已得到架构承接：

- 接入与任务启动：由 marketing / upload / uploads API / task session 支撑
- 风险诊断与排序：由 pipeline diagnosis + risks API + diagnosis feature 支撑
- 局部改写建议：由 rewrites API + pipeline rewrites + UI comparator 支撑
- 护栏式一键优化与编辑控制：由 edit operations + optimize job + rollback 模型支撑
- 反馈与决策支持：由 feedback API + workbench state + result status tracking 支撑
- 导出与数据生命周期：由 exports pipeline + deletion flow + object storage 支撑
- 内部运营与质量恢复：由 ops routes + failure recovery + task logs 支撑

**Functional Requirements Coverage:**

42 条 FR 在架构上都能找到对应支撑，没有发现“产品要求存在，但架构没有承接位”的断层。

关键覆盖点包括：

- FR3 的轻量启动任务：由匿名任务会话模式承接
- FR11/FR12 的解释与置信度：由 diagnosis pipeline + risk schema 承接
- FR23/FR24 的局部回退 / 一键回退：由 append-only `edit_operations` 承接
- FR31-FR36 的导出、格式差异、删除：由 export jobs + object storage + deletion requests 承接
- FR37-FR42 的内部运营能力：由 ops 页面、task stage、retry、failure recovery 承接

**Non-Functional Requirements Coverage:**

32 条 NFR 也都已被架构回应：

- 性能：异步队列、渐进进度、worker 拆分、前端 virtualization
- 安全与隐私：任务级访问、最小必要访问、对象存储分离、7 天保留、删除流
- 可靠性：标准阶段状态、retryable 错误、导出重试、append-only edits
- 无障碍：WCAG 2.1 AA 已进入前端模式与组件约束
- 可扩展性：queue backlog、阶段并发控制、可见降级策略已预留

### Implementation Readiness Validation ✅

**Decision Completeness:**

当前实现前必须敲定的关键决策已经足够完整：

- starter 已确定
- 核心数据架构已确定
- 队列与异步编排已确定
- API 风格与前端状态分工已确定
- 部署边界已确定
- 关键版本已在核心组件层面固定

仍然留白的部分是有意 defer，而不是遗漏，例如：

- 单元 / E2E 测试框架的具体选型
- ops 后台具体 auth library
- LLM provider 最终落地供应商

这些不阻塞架构成立。

**Structure Completeness:**

项目结构已经达到可直接指导 implementation 的粒度：

- 根目录、apps、packages、tests、docs、scripts 都已定义
- Web 与 Worker 的边界明确
- 共享 package 的职责明确
- API、UI、pipeline、db、storage、queue 的物理落点明确

**Pattern Completeness:**

AI agent 实施一致性所需的规则基本齐备：

- 命名规范完整
- 结构规范完整
- 接口格式规范完整
- 事件与状态规范完整
- 错误与 loading 规范完整
- enforcement 规则明确

### Gap Analysis Results

**Critical Gaps:**

- 无。当前没有发现会阻塞 implementation 开始的架构级缺口。

**Important Gaps:**

- 尚未固定具体测试栈：
  - 建议在 implementation 初期明确 `Vitest + React Testing Library + Playwright` 或同等级组合。
- 尚未固定 ops 登录具体实现库：
  - 当前模式已经定为 founder-only passwordless，但具体技术可在 ops story 前锁定。
- 尚未固定病毒扫描或恶意文件检测供应商：
  - 目前只预留挂点，若上线环境对上传安全要求更高，需要补齐实现方案。

**Nice-to-Have Gaps:**

- 可补一份 `error code catalog`
- 可补一份 `task stage transition matrix`
- 可补一份 `edit_operations` 示例时序图
- 可补一份 worker job retry / dead-letter 说明

### Validation Issues Addressed

本轮校验中，没有发现必须回退重做前面决策的严重问题。

已确认的关键一致性点包括：

- “SPA 体验”与 “Next.js 全栈壳层”并不冲突，因为工作台采用的是 client-heavy interaction island，而不是传统多页跳转式交互。
- “匿名任务会话”与 “数据安全要求”并不冲突，因为访问控制被收敛到了 task-scoped token + HttpOnly session，而不是彻底匿名裸访问。
- “单仓多应用 monorepo” 与 “单人开发资源受限”并不冲突，因为它减少的是系统边界重复，而不是增加平台抽象。

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

- 产品核心价值“更敢交 + 更可控”已经被清晰映射到任务状态、回退机制、局部编辑和导出架构中
- 长文档异步处理、前端工作台状态管理、文件生命周期与内部排障这四个高风险区都已有明确承接
- 目录结构和一致性规则足够具体，适合后续 AI agents 分工实现
- 关键 defer 项都被控制在非阻塞范围，没有留下隐性大坑

**Areas for Future Enhancement:**

- 补充测试栈与测试层级策略
- 补充错误码与状态机文档
- 在 implementation 初期补上 ops auth 具体实现
- 在接近上线前补齐上传安全扫描与更完整的 retention automation

### Implementation Handoff

**AI Agent Guidelines:**

- 严格遵循本文档中的架构决策，不在实现中私自更换模式
- 所有接口、schema、错误码、状态枚举必须复用既定规则
- 所有业务逻辑按既定目录边界落位，避免跨层混写
- 所有长任务都必须写标准 task stage，不允许隐式处理

**First Implementation Priority:**

先执行 starter 初始化，再建立最小贯通链路：

1. `npx create-next-app@latest <app-name> --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --empty --yes`
2. 建立 monorepo/workspace 壳层
3. 接入 `packages/contracts` + `packages/db` + `packages/queue`
4. 打通“上传 -> 创建任务 -> 入队 -> 轮询状态”的最小闭环
