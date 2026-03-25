# Story 1.1: 从 Starter Template 初始化项目与产品入口

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 访客,
I want 在进入处理流程前查看产品用途与边界，并选择工作台模式或一键优化模式,
so that 我可以在无需注册的前提下正确开始一次文档处理任务。

## Acceptance Criteria

1. 用户首次访问首页时，页面展示产品用途、适用场景、使用边界与主操作入口，并提供“工作台模式”“一键优化模式”两个清晰可辨的模式入口卡。
2. 首页必须用清晰文本展示支持格式、处理边界与关键限制，不能只依赖图标、颜色或布局暗示。
3. 用户确认任一模式后，系统无需注册即可建立匿名任务会话，并为后续任务流程建立可复用的访问上下文。
4. 模式选择完成后，前端通过 Next.js App Router 进入后续上传流程；相关服务端入口遵循 Next.js Route Handlers 的 REST/BFF 风格。
5. 项目必须基于 Next.js 官方 `create-next-app` 启动模板创建，并启用 TypeScript、Tailwind、ESLint、App Router、`src/` 目录与 `@/*` import alias。
6. 首页与模式选择页在目标桌面环境与受支持浏览器中应在 2 秒内可交互，并满足 WCAG 2.1 AA、键盘可操作与清晰焦点状态要求。
7. 仓库必须提供可直接复用的 `lint` 与 `build` 基线命令，供后续本地开发和 CI/CD 复用。

## Tasks / Subtasks

- [x] 建立 workspace 壳层并在 `apps/web` 初始化 Next.js 官方 starter（AC: 4, 5, 7）
  - [x] 在仓库根目录建立 npm workspace 壳层，保留 `_bmad-output/`、`docs/`、`_bmad/` 等现有策划资产，不把业务代码写进这些目录。
  - [x] 使用 `create-next-app` 在 `apps/web` 初始化 Web 应用，并确保生成结果启用 TypeScript、Tailwind、ESLint、App Router、`src/` 与 `@/*` alias。
  - [x] 将根级脚本收敛为至少可运行的 `lint`、`build` 命令，命令应直接调用或转发到 `apps/web`，供后续质量门禁复用。
  - [x] 不在本故事中引入数据库、队列、worker 或上传流水线实现；只搭最小可运行 Web/BFF 壳层。

- [x] 搭建产品入口页与模式选择体验（AC: 1, 2, 6）
  - [x] 实现 `apps/web/src/app/(marketing)/page.tsx` 作为首页，展示产品用途、适用场景、使用边界、支持格式与关键限制。
  - [x] 抽出可复用的“模式入口卡”组件，承载模式标题、适用场景、核心收益、风险提示与进入按钮。
  - [x] 在 `globals.css` 或主题层定义首批 design tokens，体现浅色工作台、蓝灰主品牌色、中等密度与清晰层级。
  - [x] 保证页面桌面优先，同时对窄屏提供可访问降级，不承诺移动端完整工作台编辑体验。

- [x] 建立模式确认后的匿名访问上下文与进入路径（AC: 3, 4）
  - [x] 以“匿名任务会话 + HttpOnly cookie + 后续可升级为 task-scoped token 的 opaque context”为基础，建立预上传访问上下文。
  - [x] 模式确认后导航到统一的上传入口页，例如 `apps/web/src/app/(workspace)/upload/page.tsx`；模式信息可通过安全 cookie、search params 或受控服务端状态传递。
  - [x] 若需要显式服务端入口，使用资源风格 Route Handler（例如 `app/api/task-contexts/route.ts` 这一类资源命名），不要创建 `getSession`、`startTask` 之类动词式接口。
  - [x] 明确本故事只创建“预上传上下文”，不创建持久化 processing task 记录；真正的任务落库由 Story 1.3 负责。

- [x] 加入最小质量校验与可持续约束（AC: 6, 7）
  - [x] 验证 `lint`、`build` 在新脚手架下可运行。
  - [x] 为关键交互补齐键盘操作、可见 focus、语义标签与文本化状态说明。
  - [x] 如增加自动化测试，优先选择未来兼容架构建议的 `Vitest + React Testing Library` 方向；不要因测试框架选型阻塞本故事交付。

## Dev Notes

### Story Intent & Boundaries

- 这是项目起始故事，目标是“可运行的 Web/BFF 壳层 + 首页入口 + 模式选择 + 预上传匿名上下文”。
- 不要在本故事提前实现上传受理、文档校验、任务持久化、队列入队、扫描任务、风险列表或导出能力；这些分别属于后续 Story 1.2、1.3 与 Epic 2+。
- “匿名任务会话”在本故事中应理解为预上传访问上下文，而不是完整任务实体。真正 task row 的创建必须等用户上传并受理成功后再做。

### Developer Guardrails

- 当前工作区没有现成应用代码，且未检测到 git 仓库；按“从零启动”的方式实现，但不要改动 BMAD 产出的规划文档结构。
- 架构已经明确后续目标是单仓多应用结构，因此不要把 Next.js 应用初始化在仓库根目录并长期保留；应直接落在 `apps/web`，外层根目录保留 workspace 壳层。
- 本故事允许先只创建 `apps/web`，但根级结构与脚本命名必须为后续 `apps/worker`、`packages/*` 预留空间。
- `app/` 目录只放路由、layout、页面壳层和 Route Handlers；业务逻辑不要直接堆进 `app/`，应放到 `features/`、`components/`、`lib/`。
- 首页文案必须避免“绕过检测”“降 AI 率”这类不可信或激化风险的表达，统一采用“降低模板感、增强作者感、提升提交信心”的中性语言。

### Architecture Compliance

- Starter 与 Web 壳层
  - 基于 Next.js 官方 `create-next-app` 起步。
  - 采用 Next.js 16.x、App Router、TypeScript、Tailwind、ESLint、`src/`、`@/*` alias。
  - 产品整体是“全栈 Web + SPA 式工作台壳层”，不是纯静态营销站，也不是纯前端单页工具。

- Monorepo 与目录边界
  - 根目录放 workspace / CI / shared 配置。
  - `apps/web` 放 Next.js 专属配置和 Web/BFF 代码。
  - 后续 worker 与共享 package 进入 `apps/worker`、`packages/*`，本故事不要伪造这些目录里的业务实现。

- 路由与页面
  - 首页应落在 `apps/web/src/app/(marketing)/page.tsx`。
  - 模式选择后进入 `apps/web/src/app/(workspace)/upload/page.tsx` 或同等级工作台上传入口。
  - 后续 API 采用 `app/api/*/route.ts`，保持资源式 REST/BFF 命名。

- 认证与安全
  - MVP 不要求注册登录。
  - 访问控制模式为“匿名任务会话 + HttpOnly cookie + task-scoped opaque token”。
  - 本故事只做预上传上下文 bootstrap，不做完整 task 授权流。
  - 所有 cookie-bound mutation 在后续故事中要接入 CSRF 防护，因此本故事不要设计成只能依赖不安全本地存储的方案。

### Library / Framework Requirements

- Next.js
  - `create-next-app` 是强约束，不要改用 Vite、React Router 或手工拼装 Next 项目。
  - Next.js 16 需要显式 lint 脚本；不要依赖 `next build` 自动跑 lint。
  - App Router 页面建议采用“server-rendered shell + client-heavy interaction island”，这与本项目的 SPA 式工作台目标一致。

- Tailwind CSS
  - 保持 starter 生成的 Tailwind 集成方式；如果需要手工补齐，遵循 Tailwind 4 的 CSS-first / PostCSS 方式，不要无依据回退到旧版配置习惯。
  - 主题变量优先通过 CSS variables / design tokens 暴露，服务后续可主题化设计系统。

- 测试与质量
  - 本故事最低门禁是 `lint` 与 `build`。
  - 测试框架不必一次性配齐，但如果要补最小 smoke test，应优先沿 `Vitest + React Testing Library` 方向演进，避免后续重做。

### File Structure Requirements

- 推荐最小实现结构
  - `package.json`：根级 workspace 与脚本入口。
  - `apps/web/package.json`：Next.js app 依赖与 app 专属脚本。
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/globals.css`
  - `apps/web/src/app/(marketing)/page.tsx`
  - `apps/web/src/app/(workspace)/upload/page.tsx`
  - `apps/web/src/components/shared/ModeEntryCard.tsx`
  - `apps/web/src/lib/auth/`：匿名上下文 bootstrap 逻辑。
  - `apps/web/src/features/entry/`：首页与模式选择组合逻辑。

- 禁止事项
  - 不要把业务逻辑直接塞进 `page.tsx` 后无法复用。
  - 不要在 `public/` 存放真实用户文件或运行态数据。
  - 不要为一个简单模式选择页提前引入 Zustand、TanStack Query、Drizzle、BullMQ 等后续故事才需要的复杂依赖，除非 starter 自带。

### UX Requirements

- 首页应是“任务入口清晰、上传即处理、结果优先展示”策略的起点，而不是功能广场。
- 模式入口卡必须包含：模式标题、适用场景说明、核心收益、风险提示、主按钮。
- 同一区域只允许一个视觉最强主操作；不要让两个模式卡同时出现等权主按钮竞争而缺乏聚焦。
- 页面气质应稳定、清晰、可信，不过度装饰；采用浅色工作台、蓝灰主色、中等密度。
- 必须支持键盘导航、Enter/Space 激活、清晰 focus、足够对比度、文本化状态说明。
- 首页需要清楚说明支持格式与处理边界，但不在本故事中实现真实上传。

### Testing Requirements

- 必做验证
  - 根级 `lint`
  - 根级 `build`
  - 首页加载与模式选择路径可达
  - 键盘可完成模式切换与按钮触发

- 推荐但非阻塞
  - 对 `ModeEntryCard` 做最小渲染/交互测试。
  - 对首页关键信息块做语义与可访问性断言。

### Previous Story Intelligence

- 不适用。本故事是首个实现故事，没有前序 story 可继承。

### Git Intelligence Summary

- 不适用。当前目录不是 git 仓库，无法从提交历史抽取既有实现模式。

### Latest Technical Information

- Next.js 官方 `create-next-app` 文档与 Next.js 16 发布说明确认：新项目默认围绕 App Router、TypeScript、Tailwind、ESLint 与 Turbopack 组织；Node.js 最低版本为 20.9+。
- Next.js 16 起，`next lint` 命令已移除，`next build` 不再自动执行 lint；项目必须显式提供 ESLint CLI 脚本。
- Next.js 官方 SPA 指南说明，App Router 完全可以承载 SPA 式体验；本项目应采用“服务端壳层 + 客户端交互岛”而非退回纯客户端路由方案。
- Next.js Route Handlers 官方约定要求 API 入口位于 `route.ts`；这与本项目的 REST/BFF 资源式接口设计一致。
- Tailwind CSS 4 官方文档强调 CSS-first 与 `@import "tailwindcss"` / `@tailwindcss/postcss` 集成方式；如果脚手架产物与旧版教程不同，以当前官方集成为准。

### Project Structure Notes

- 当前仓库主要包含 BMAD 文档与输出物，没有现成业务代码。
- 没有 `project-context.md` 可引用。
- 实现时应把代码落在新的 workspace/app 结构中，同时保留现有 `_bmad-output/` 作为规划资产，不将其混入运行时代码。

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` -> `Epic 1` / `Story 1.1`]
- [Source: `_bmad-output/planning-artifacts/prd.md` -> `Product Access & Task Initiation`, `Web Application Specific Requirements`, `Performance`, `Accessibility`]
- [Source: `_bmad-output/planning-artifacts/architecture.md` -> `Selected Starter: Next.js 官方 create-next-app`, `Authentication & Security`, `API & Communication Patterns`, `Frontend Architecture`, `Complete Project Directory Structure`, `Implementation Handoff`]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` -> `Design System Foundation`, `Color System`, `Spacing & Layout Foundation`, `模式入口卡`, `Button Hierarchy`, `Navigation Patterns`, `Accessibility Strategy`]
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-23.md` -> `Story 1.1 已补入最小质量门禁基线`]
- [Official: Next.js `create-next-app` docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [Official: Next.js installation docs](https://nextjs.org/docs/app/getting-started/installation)
- [Official: Next.js SPA guide](https://nextjs.org/docs/app/guides/single-page-applications)
- [Official: Next.js Route Handlers docs](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Official: Next.js 16 release notes](https://nextjs.org/blog/next-16)
- [Official: Tailwind CSS framework guides](https://tailwindcss.com/docs/installation/framework-guides)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 未检测到前序 story 文件。
- 未检测到 git 仓库。
- 未检测到 `project-context.md`。
- `create-next-app` 首次在沙箱中因 npm registry / cache 访问失败，随后在获批命令下完成脚手架初始化。
- `next build` 在沙箱内的 TypeScript 子进程阶段触发 `spawn EPERM`，脱离沙箱后已完成生产构建验证。

### Completion Notes List

- 已将本故事收敛为“starter + 首页入口 + 模式选择 + 预上传匿名上下文”，避免提前侵入上传、任务落库和 worker 范围。
- 已明确 `create-next-app` 与 monorepo 目标结构的衔接方式：先在 `apps/web` 初始化，再由根级 workspace 壳层承接。
- 已补入 Next.js 16 的关键最新约束：Node.js 20.9+、显式 lint 脚本、App Router / Route Handlers / SPA 指南。
- 已实现首页营销入口、模式入口卡、上传入口页与 `POST /api/task-contexts` Route Handler，并用 HttpOnly cookie 建立预上传匿名上下文。
- 已完成根级 `npm run lint`、`npm run test`、`npm run build` 验证；其中生产构建在脱离沙箱后通过。

### File List

- `.gitignore`
- `package.json`
- `apps/web/package.json`
- `apps/web/src/app/(marketing)/page.tsx`
- `apps/web/src/app/(workspace)/upload/page.tsx`
- `apps/web/src/app/api/task-contexts/route.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx` (deleted)
- `apps/web/src/app/task-context-check.mjs`
- `apps/web/src/components/shared/ModeEntryCard.tsx`
- `apps/web/src/features/entry/HomePage.tsx`
- `apps/web/src/features/entry/mode-options.tsx`
- `apps/web/src/lib/auth/task-context.test.mjs` (deleted)
- `apps/web/src/lib/auth/task-context.ts`
- `_bmad-output/implementation-artifacts/1-1-从-starter-template-初始化项目与产品入口.md`

## Change Log

- 2026-03-23: 初始化 `apps/web` Next.js 16 starter，建立 root workspace 壳层，实现首页模式入口、预上传匿名上下文 Route Handler、上传入口页与基础验证脚本；完成 lint、test、build 验证。
