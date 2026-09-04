# FlowMind 对话「AI 生成动态 UI」升级：json-render Inline + RSC 预渲染

## Context（为什么做）

FlowMind 目前靠自研的 `render_component` client tool + `componentDefs` 白名单（20 组件）+ 手写 `COMPONENT_SHAPES` 提示词来让 AI 渲染动态 UI。自研的 `compose`（组装式）功能有限，且提示词/校验全靠手写维护。

用户调研后确认：**Vercel 官方 json-render（v0.20，成熟活跃）正是生产级版本**，应作为对话内组装式 UI 的主力引擎，替代自研 compose；**不引入 A2UI**（与 json-render 功能重叠）；同时用 **react-generative-ui 在 RSC 侧预渲染对话中的 AI 生成组件**，提升首屏与 SEO。

目标：

1. json-render Inline 模式嵌入现有 chat 流式管线（`streamText` → `pipeJsonRender` → `toUIMessageStreamResponse`），AI 在对话流里内联输出 JSONL patches，客户端 `useJsonRenderMessage` 编译成 spec 用 `<Renderer>` 渲染。
2. 用 `catalog.prompt({mode:'inline'})` 自动生成系统提示词，替代手写 `COMPONENT_SHAPES`。
3. 会话持久化补 `parts` 落库，历史会话恢复时组件能重渲染。
4. react-generative-ui 在服务端把 AI 生成组件预渲染成 RSC HTML（会话快照），与客户端流式互补。
5. 分阶段渐进（render\_component 全程兜底），每阶段可独立验证、可回滚。

## 关键架构决策

- **json-render 作对话内主力引擎（Inline 模式）**；保留 `render_component`/`ui_action`/`deep_task`/业务工具 作为兜底过渡，P3 再收敛。

- **不引入 A2UI**。

- **react-generative-ui 用于 RSC 预渲染对话组件**（B 主交付：会话快照 island）。

- **react-generative-ui 支撑动态工作流页面的 RSC 路由**（C）：新增 `/wf/[slug]` 类 RSC 路由，把 `wf_workflow_specs`（动态工作流 spec）或工作流运行结果用 react-generative-ui 在服务端预渲染成 HTML——复用 `/p/[slug]` 的 `connection()` + `generateStaticParams` 约定，与 AI 动态页面同架构但针对工作流产物。

***

## C. 动态工作流页面 RSC 路由（新增，回应用户补充）

现状：`wf_workflow_specs`（M4 plan\_workflow 落库）与 `wf_page_specs`（M5 generate\_page）都在 `lib/kernel/plugins/spec-store.ts` 的 `SpecStoreService`；`wf_page_specs` 已有 `/p/[slug]` RSC 渲染，但**动态工作流只有 dashboard 岛展示 + POST /api/agent/workflows/\[id]/run 执行，没有独立 RSC 页面路由**。

目标：让 react-generative-ui 在服务端把「动态工作流产物」预渲染成独立 RSC 页面，与 `/p/[slug]` 平行。

### C1 新路由：`app/wf/[slug]/page.tsx` + `app/wf/[slug]/page-spec-renderer.tsx`

- `page.tsx`：async RSC，`loadSpec` 走 `kernel.specs.getWorkflowSpec(slug)`（复用 spec-store 服务），沿用 `/p/[slug]` 的 `connection()`（cacheComponents 动态渲染标记）+ `generateStaticParams` 返回 sample（build-time validation）。`notFound()` 兜底。Suspense 包裹（async params 须落 Suspense 内）。

- `page-spec-renderer.tsx`（`'use client'`）：

  - 工作流 spec = `{ steps: [{ id, tool, args?, dependsOn? }] }`（`workflowSpecSchema`），本身是**执行 DAG 而非 UI 树**。

  - 渲染策略：把每个 `step` 映射成 react-generative-ui 可渲染的组件块——`withSchema` 包一个「步骤卡」组件（显示 tool / 状态 / args 摘要 / dependsOn 拓扑），或用 `specToBlocks` 把 steps 转成 `UIBlock[]`，交给 `<RscGenerativeRenderer>`（复用 B 的 `rscRegistry` + `GenerativeRenderer`）。

  - 若某步骤产物是 AI 生成的文本（含 `{"componentName":...}` 内嵌 JSON），用 `parseTranscriptText`/`parseBlocks` 抽取并预渲染。

  - 运行状态（最新 `wf_workflow_runs`）经服务端读入作为 props，展示「最后运行 / 每步状态」。

### C2 与对话内 UI 的关系

- json-render Inline 负责**对话内实时**生成 UI；react-generative-ui RSC 负责**服务端预渲染**的持久产物页面（会话快照岛 + `/wf/[slug]` + 可选 `/p/[slug]` 升级）。

- 工作流页面作为「AI 规划 → 落库 → RSC 预渲染」的完整闭环，与 `generate_page` 的 `/p/[slug]` 同构但数据源为 `wf_workflow_specs`。

***

## 依赖

```
bun add @json-render/core @json-render/react @json-render/directives react-generative-ui
```

| 包                            | 用途                                                                                | 备注                                        |
| ---------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| `@json-render/core` ^0.20    | catalog / prompt / pipeJsonRender / compileSpecStream                             | Vercel 生态，React 19 兼容                     |
| `@json-render/react` ^0.20   | Renderer / defineRegistry / useJsonRenderMessage / StateProvider / ActionProvider | `schema` 从 `@json-render/react/schema` 导入 |
| `@json-render/directives`    | `$format/$math/$concat` 等（standardDirectives）                                     | 可选，推荐                                     |
| `react-generative-ui` ^0.4.6 | parseBlocks / createStreamingParser / GenerativeRenderer / withSchema             | RSC 快照                                    |

***

## 文件清单

### 新建

1. `lib/agent/genui/catalog.ts`（共享层，仅 zod）—— `defineCatalog(schema, { components: 由 componentDefs 派生, actions })`；导出 `catalog`。
2. `lib/agent/genui/registry.tsx`（`'use client'`）—— `defineRegistry(catalog, { components })` 复用 `def.render`；导出 `genuiActionHandlers`（runUiAction / answerQuestion，内部复用 `getActionById`/L2/`send`）。
3. `components/agent/generated/json-render-view.tsx`（`'use client'`）—— `useJsonRenderMessage(message.parts)` + `StateProvider`/`ActionProvider` + `<Renderer>`，两入口复用。
4. `lib/server/agent/genui-prompt.ts`（server-only）—— 组装 `catalog.prompt({mode:'inline', system, customRules})` 注入 system。
5. `lib/server/agent/genui-rsc.ts`（server-safe 纯函数）—— `specFromParts` / `specToBlocks` / `parseTranscriptText` / `workflowToBlocks`。
6. `components/agent/generated/rsc-generative-renderer.tsx`（`'use client'`）—— `rscRegistry`（`withSchema` 包 `componentDefs`）+ `<GenerativeRenderer>`。
7. `app/conversations/[id]/page.tsx` + `islands/transcript-island.tsx`（会话快照，RSC 预渲染）。
8. **`app/wf/[slug]/page.tsx`** **+** **`app/wf/[slug]/page-spec-renderer.tsx`（动态工作流 RSC 页面，C 部分新增）。**
9. `e2e/agent-genui.spec.ts` —— 确定性测试缝 `window.__genUI`。

### 修改

1. `app/api/agent/chat/route.ts` —— ① 尾部 `pipeJsonRender` + `createUIMessageStream` + `createUIMessageStreamResponse`；② system 拼 `catalog.prompt`；③ `render_component` 描述过渡期精简；④ `onFinish` 额外落 `parts`。
2. `components/agent/agent-drawer.tsx` —— `renderMessage` 加 `JsonRenderMessageView` 分支；Provider 注入；保留 onToolCall/L2。
3. `app/dashboard/dashboard-chat.tsx` —— 同上。
4. `lib/agent/chat-contract.ts` —— `AgentUIMessage` 补 data part；`dbMessageToUI` 从 DB `parts` 重建 data part。
5. `app/p/[slug]/page.tsx` + `page-spec-renderer.tsx`（可选 B 升级，P4 评估）。

***

## 实施阶段

### P0 脚手架

装依赖；建 `catalog.ts`/`registry.tsx`（只映射不接线）；`bun run build` 通过。

- 用 `catalog.validate()` 离线验证连字符组件 key（`stat-card`）兼容性，不行则驼峰别名。

### P1 Inline 上线（服务端+客户端）

- 改 `chat/route.ts`：尾部 `createUIMessageStream({ execute: ({writer}) => writer.merge(pipeJsonRender(result.toUIMessageStream())) , onError })` → `createUIMessageStreamResponse({ stream })`；system 拼 `catalog.prompt({mode:'inline', customRules})`。

- drawer / dashboard-chat 接 `JsonRenderMessageView` + Providers；**保留 render\_component**。

- customRules：① 结论优先内联组件树；② 同轮只走一条 UI 通道；③ 结论来自工具真实返回。

- 验证：`bun run dev` 问「做个看板/对比/排行」→ 流式 spec 渲染；ui\_action/L2、deep\_task、业务工具步骤卡仍正常；`bun run lint`。

### P2 持久化与恢复

- `onFinish` 落 `parts`（含 data-spec patches，`conversationService.appendMessage` 已支持 parts）。

- `dbMessageToUI` 重建 data part；恢复会话后历史组件重渲染。

### P3 收敛

- 删 `render_component` tool + `COMPONENT_SHAPES` + `compose` 组件实现（组件实现保留供 registry 复用）；移除「双通道」禁令；`generate_page` 页面 spec 评估迁移。

### P4 RSC 预渲染

- `genui-rsc.ts` + `rsc-generative-renderer.tsx` + 会话快照 island（沿用 `/p/[slug]` 的 `connection()` + `generateStaticParams` 约定）。

- **C：新增** **`/wf/[slug]`** **动态工作流 RSC 页面**——`page.tsx`（async RSC 读 `getWorkflowSpec`）+ `page-spec-renderer.tsx`（`workflowToBlocks` 把 steps DAG 转 UIBlock，`RscGenerativeRenderer` 预渲染步骤卡 + 运行状态）。

- 可选 `/p/[slug]` 升级（`specToBlocks` + `RscGenerativeRenderer`）；补 e2e。

***

## 关键实现注意

- **`pipeJsonRender`** **穿透工具调用**：它只筛文本行（能 parse 成 RFC 6902 JSONL patch 的抽成 data part，其余照常 text），工具调用（ui\_action/deep\_task/render\_component）是独立 UIMessageStream part 原样穿透——不破坏现有编排链。

- **actions vs client tools 共存**：`ui_action`/`render_component` 是模型主动发起的 client tool（onToolCall + addToolResult + L2）；json-render action 是生成 UI 元素绑定的交互（按钮 onClick → ActionProvider → 同一套 action 路由 + L2 门）。两者各司其职，不合并。

- **RSC 快照限制**：react-generative-ui 的 `UIBlock` 是扁平的（无 children/slots/repeat 嵌套），`specToBlocks` 只保根层组件；`GenerativeRenderer` 含 React 状态须放 client boundary。图表（recharts）`ssr:false`——快照面渲 `ComponentSkeleton` 占位、hydration 后替换，避免 mismatch。

- **cacheComponents**：新 RSC island 必须带 sample `generateStaticParams`（参照 `app/p/[slug]/page.tsx`），否则 build-time validation 报错。

## 验证

- `bun run build`（Next 16 + cacheComponents）。

- `bun run dev` 手工链路：drawer 三态 + dashboard 沉浸式各来「生成看板→进舞台→点生成 UI 内按钮触发 L2→批准→回传续推」；切换/恢复历史会话验证组件重现；`curl /api/agent/chat` 观察 `data-spec` part 与 tool part 交错。

- e2e：`bun run test:e2e`，重点回归 `agent-actions.spec.ts`（L2/`window.__agentUI`）、`dashboard.spec.ts`、`navigation.spec.ts`。

- 旧数据兼容：历史含 `render_component` part 的会话在 P1 后仍能渲染。

## 风险与回滚

- 双通道输出打架 → customRules 强约束 + P3 删工具根治。

- `pipeJsonRender` 与工具流交错 → P1 真实流验证；异常时按请求 flag 走 Inline 或原 `toUIMessageStreamResponse`（灰度开关）。

- JSONL patch 解析失败 → 服务端 `catalog.validate(spec)` 终态校验，非法降级文本；客户端 `Renderer` 有 fallback。

- 回滚：P1-P3 任一步 `git revert` 聊天链路即回现状（render\_component 全程兜底）；parts 落库向后兼容。

