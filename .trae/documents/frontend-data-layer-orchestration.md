# 前端数据层全打通 — 编排环环相扣方案

## Summary

把「发起编排」和全局 AI 编排面板从「演完即消失」改造成**真实执行、Supabase 持久化、全站数据联动**的编排中枢：

- 仪表盘「发起编排」→ 打开真实 AI 编排面板，替代硬编码台词动画
- AI 面板工具结果 → 一键转为任务 / 存入内容库 / 跳转对应工作流页（环环相扣）
- 编排会话 + 产物 → 持久化到 Supabase，刷新不丢、可回溯
- 编排发生 → 全站相关卡片自动刷新（dashboard / 任务中心 / 内容库）
- 全程无 mock：AI 层已无 mock（`AIConfigError` 引导配 key），仅剩的 UI 假数据（AiLivePanel）本次删除

## Current State Analysis（基于代码探索）

| 现状 | 位置 | 问题 |
|------|------|------|
| 「发起编排」是假动画 | `app/dashboard/dashboard-ai-live.tsx`（硬编码 `LINES`/`STEP_DEFS` + setTimeout 打字机） | 跑完不产生任何数据 |
| 真实编排器已存在 | `lib/orchestrator/orchestrator.ts`（5 轮工具循环）+ `tool-registry.ts`（9 个工具真实调 `WorkflowService`）+ `hooks/use-orchestrator.ts`（SSE）| 会话仅存内存 state，刷新丢失 |
| block 渲染器已支持操作 | `components/orchestrator/BlockRenderer.tsx`（`tool_result`/`idea_bubble` + `onIdeaAction`） | 结果卡片无「转化」动作，数据不落库、不联动页面 |
| 全局面板已全局挂载 | `components/layout/app-shell.tsx`（`OrchestratorProvider` + `FloatingAIButton` + `OrchestratorPanel`） | 与 dashboard 页面零关联 |
| AI 层已无 mock | `lib/ai/index.ts`：无 key 抛 `AIConfigError`；默认 openai 兼容（mimo） | 编排失败时前端无配置引导 |
| 数据全在 Supabase | `lib/db/index.ts` `getSupabase()`；迁移在 `supabase/migrations/`（已到 00008）；RLS `anon_all` | 缺编排会话表 |
| 产物落点已存在 | 表 `wf_generated_listings` / `wf_generated_images` / `wf_generated_research`；API `/api/tasks`、`/api/workflows/ai-listing/publish` | 编排结果没有通往这些落点的路径 |
| dashboard islands 是一次性 SSR 快照 | `app/dashboard/islands/*`、`dashboard-workflows.tsx` 等 | 编排后页面数据不刷新 |

## Proposed Changes

### A. Supabase 迁移：`supabase/migrations/00009_orchestrator_sessions.sql`

```sql
CREATE TABLE IF NOT EXISTS orchestrator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '新会话',
  messages JSONB NOT NULL DEFAULT '[]',   -- OrchestratorMessage[]（含 blocks）
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE orchestrator_sessions ENABLE ROW LEVEL SECURITY;
-- 沿用 00002 的 anon_all 策略约定
```

### B. 会话持久化 API + hook 改造

- 新增 `app/api/orchestrator/sessions/route.ts`：`GET`（列表，按 updated_at 倒序）、`POST`（新建，标题取首条消息前 20 字）
- 新增 `app/api/orchestrator/sessions/[id]/route.ts`：`GET` 单个、`PATCH`（追加/覆盖 messages + updated_at）、`DELETE`
- 改造 `hooks/use-orchestrator.ts`：
  - 持有 `sessionId`；每条 assistant 消息 `finished` 后自动 PATCH 落库（含工具结果 blocks）
  - 新增 `loadSession(id)` / `newSession()`
- `components/orchestrator/OrchestratorPanel.tsx`：顶部加会话切换器（历史列表 + 新会话按钮）

### C. 产物一键转化（环环相扣核心）

改造 `components/orchestrator/BlockRenderer.tsx` 的 `tool_result` 卡片，按 `toolId` 加操作区：

| toolId | 操作 | 落点 |
|--------|------|------|
| `listing_generate` | 「存入内容库」→ POST `/api/workflows/ai-listing/publish` | `wf_generated_listings` → 链接 `/workflows/ai-listing` |
| `imaging_generate` | 「查看图片」链接（generate 已自动入库） | `/workflows/ai-imaging` |
| `competitor_analyze` / `product_research` | 「查看报告」链接 | 对应工作流页 |
| 全部工具 | 「转为任务」→ POST `/api/tasks`（title=summary，description=结果摘要 JSON） | `tasks` 表 → `/tasks` |

- 已保存的卡片显示「已保存 ✓」并禁用按钮（state 记在组件内）
- `idea_bubble` 的 `onIdeaAction` 把 `idea.params` 透传给 `selectOption`（hook 已留 `params` 形参，当前未用），实现「上游结果 → 下游工具参数」接力

### D. 全站数据联动

- `components/providers/orchestrator-provider.tsx`：暴露 `open()`；工具执行成功后 `window.dispatchEvent(CustomEvent("flowmind:data-changed"))`
- 新增 `hooks/use-data-changed.ts`：`useDataChanged(callback)` 订阅该事件
- 接入点（各客户端组件监听后 `refetch()` / 触发 `router.refresh()`）：
  - `app/dashboard/dashboard-workflows.tsx`、`dashboard-stats` 数据（refetch 对应 API）
  - `hooks/use-tasks.ts`（任务中心）
  - OrchestratorPanel `finished` 且本次发生过工具调用时 `router.refresh()`（刷新 SSR islands）

### E. 仪表盘「发起编排」真实化

- `app/dashboard/dashboard-shell.tsx`：按钮 onClick 改为调用 OrchestratorProvider 的 `open()`；删除 `runSignal`
- `app/dashboard/dashboard-ai-live.tsx` 重写为「实时任务流」：
  - `useFetch("/api/tasks?pageSize=20")` + `useDataChanged` refetch + 30s 兜底轮询
  - 渲染真实任务：标题、状态 badge、steps 进度、时间；运行中高亮；空状态引导发起编排；点击跳 `/tasks`
  - 删除全部硬编码台词/打字机代码

### F. 人性化细节

- 流式 `error` block 且 message 含「未配置」时，卡片附「去设置」按钮 → `/settings`
- 转化成功用内联「已保存 ✓」反馈，失败显示可重试按钮

## Assumptions & Decisions

1. **Supabase** 存储会话（用户指定）；RLS 沿用现有 `anon_all` 模式
2. **零 mock**：AI 层已达标；本次删除唯一的 UI 假数据（AiLivePanel 硬编码）
3. AI provider 默认 mimo（openai 兼容）已被 `callAIWithTools` 的 openai 分支覆盖，provider 层无需改动
4. `/api/workflows/ai-listing/publish` 的 body 结构在实现时读取该 route 对齐
5. 现有页面结构/路由不变，只加不改

## Verification

1. `bunx tsc --noEmit` 通过
2. 更新 `e2e/dashboard.spec.ts` 中依赖旧 AiLivePanel 的 2 个用例（「AI orchestration panel with steps」「trigger orchestration on button click」）为新行为断言；运行 `bun run test:e2e -- e2e/dashboard.spec.ts e2e/rsc-features.spec.ts` 通过
3. 浏览器手测闭环：发起编排 → 面板真实执行工具 → 「转为任务」→ 任务中心可见该任务 → dashboard 实时任务流自动出现 → 刷新页面对话仍在（Supabase 回溯）
