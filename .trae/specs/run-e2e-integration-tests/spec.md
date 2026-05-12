# E2E 前后端联调测试 Spec

## Why
前端已完成 PPR 岛架构转换、Python FastAPI 后端已搭建、40 个 API route 已改为代理转发、9 个 Playwright 测试文件已编写。需要运行全链路测试验证数据流畅通：RSC island → Next.js API route → backend-client → Python FastAPI → mock_data。

## What Changes
- 启动 Python 后端 (port 8000) 和 Next.js 前端 (port 3000)
- 运行 9 个 E2E 测试文件（共 ~50 个测试用例）
- 分析失败用例，定位根因（页面结构变更 / API 数据不匹配 / 选择器过时）
- 修复前端页面代码或测试代码中的问题
- 确保所有测试通过

## Impact
- Affected specs: 前端 PPR 架构、后端 API、测试套件
- Affected code: `e2e/*.spec.ts`、页面/组件文件（如选择器需调整）、`backend/routers/*.py`（如数据格式需修复）

## ADDED Requirements
### Requirement: 全链路集成测试通过
系统 SHALL 在前端+后端同时运行时，所有 9 个 E2E 测试文件的全部用例均通过。

#### Scenario: 后端健康检查
- **WHEN** 访问 `http://localhost:8000/health`
- **THEN** 返回 `{"status": "ok"}`

#### Scenario: Dashboard 全链路
- **WHEN** 用户访问 `/dashboard`
- **THEN** Suspense skeleton 出现后被真实数据替换，统计卡片（总销售额、活跃Agent、运行中任务、风险事件）可见

#### Scenario: 6 个工作流页面加载
- **WHEN** 用户访问任一工作流页面
- **THEN** PPR 岛从 Python 后端获取数据并渲染

#### Scenario: 导航与路由
- **WHEN** 用户通过侧边栏导航到各页面
- **THEN** 所有 12 个路由可正常访问

## MODIFIED Requirements
### Requirement: 测试选择器适配
测试中使用的 CSS 选择器和文本断言可能需要根据 PPR 转换后的页面结构进行调整。页面不再使用旧的硬编码数据结构，选择器需匹配实际渲染的 DOM。
