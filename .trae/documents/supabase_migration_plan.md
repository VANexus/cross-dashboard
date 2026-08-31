# Supabase Query Builder 改造实施计划

## 概述
将 3 个 Repository 文件 + base.ts 中的 `paginatedQuery` 从 sql.js(sync) 风格改写为 Supabase query builder(async) 风格。

---

## 文件 1: `lib/repositories/base.ts`

### 改动点

#### 1.1 import 变更
- `import { getDb } from "../db";` → `import { getSupabase } from "../db";`

#### 1.2 `paginatedQuery` 函数改造
- 改为 `async`，返回 `Promise<PaginatedResult<T>>`
- 内部使用 `const sb = getSupabase();`
- COUNT 查询: 使用 `sb.from(table).select('*', {count:'exact', head:true})` + 条件链
- 数据查询: 使用 `sb.from(table).select('*')` + 条件链 + `.order()` + `.range()`
- 条件解析: 将 `where` 字符串和 `params` 数组解析为链式 `.eq()` 调用
  - 由于 where 是 "WHERE 1=1 AND col=? AND col2=?" 格式，params 是值数组
  - 需要手动构建 Supabase 查询链

#### 1.3 `parseJsonField` 函数
- **保持不变**（纯工具函数，不涉及 DB）

---

## 文件 2: `lib/repositories/task.repository.ts`

### 改动点

#### 2.1 import 变更
- `import { getDb } from "../db";` → `import { getSupabase } from "../db";`

#### 2.2 内部函数 `getStepsForTask`
- 签名改为 `async function getStepsForTask(sb: ReturnType<typeof getSupabase>, taskId: string): Promise<TaskStep[]>`
- SQL: `SELECT * FROM task_steps WHERE task_id = ? ORDER BY sort_order`
- Supabase: `await sb.from('task_steps').select('*').eq('task_id', taskId).order('sort_order')` → `.data as StepRow[]`

#### 2.3 `getTasks` 函数
- 改为 `export async function getTasks(...): Promise<PaginatedResult<Task>>`
- 内部: `const sb = getSupabase();`
- 调用 `await paginatedQuery<TaskRow>(...)`（已改为 async）
- 对每个 row，`await getStepsForTask(sb, row.id)`

#### 2.4 `getTaskById` 函数
- 改为 `export async function getTaskById(id: string): Promise<Task | null>`
- 内部: `const sb = getSupabase();`
- SQL: `SELECT * FROM tasks WHERE id = ?` → `await sb.from('tasks').select('*').eq('id', id).maybeSingle()` → `.data as TaskRow | null`

#### 2.5 `createTask` 函数
- 改为 `export async function createTask(...): Promise<Task>`
- 内部: `const sb = getSupabase();`
- INSERT tasks: 使用 `await sb.from('tasks').insert({...})`
  - 字段映射: id, title, description, status='pending', priority, assigned_agents=JSON.stringify
- INSERT task_steps: 循环调用 `await sb.from('task_steps').insert({...})` 或批量 insert
  - 字段: id, task_id, name, status='pending', agent_id='', sort_order
- 返回: `await getTaskById(id)` 并断言非空

#### 2.6 `updateTask` 函数
- 改为 `export async function updateTask(...): Promise<Task | null>`
- 内部: `const sb = getSupabase();`
- 构建 update 对象:
  - `updated_at` 使用 Supabase 的 `now()` 或手动生成 ISO 字符串
  - status='completed' 时设置 `completed_at`
  - assignedAgents 需 JSON.stringify
- 调用: `await sb.from('tasks').update(updateObj).eq('id', id)`
- 返回: `await getTaskById(id)`

#### 2.7 `deleteTask` 函数
- 改为 `export async function deleteTask(id: string): Promise<boolean>`
- SQL: `DELETE FROM tasks WHERE id = ?` → `const { error } = await sb.from('tasks').delete().eq('id', id)`
- 返回: `!error` 或检查 status

#### 2.8 `updateTaskStep` 函数
- 改为 `export async function updateTaskStep(taskId: string, stepId: string, data: Partial<TaskStep>): Promise<TaskStep | null>`
- 构建 update 对象（注意字段映射: agentId→agent_id 等）
  - status='running' → started_at = now
  - status='completed' → completed_at = now
- 调用: `await sb.from('task_steps').update(updateObj).eq('task_id', taskId).eq('id', stepId)`
- 查询更新后的数据: `await sb.from('task_steps').select('*').eq('task_id', taskId).eq('id', stepId).maybeSingle()`

---

## 文件 3: `lib/repositories/rak.repository.ts`

### 改动点

#### 3.1 import 变更
- `import { getDb } from "../db";` → `import { getSupabase } from "../db";`

#### 3.2 `saveMessage` 函数
- 改为 `export async function saveMessage(...): Promise<RAKMessage>`
- INSERT: `await sb.from('rak_messages').insert({id, from_agent:msg.from, to_agent:msg.to, type:msg.type, protocol:msg.protocol, payload:JSON.stringify(msg.payload), status:'pending', ttl:msg.ttl})`
- 查询: `await sb.from('rak_messages').select('*').eq('id', msg.id).single()`

#### 3.3 `getMessagesForAgent` 函数
- 改为 `export async function getMessagesForAgent(agentId: string, status?: string): Promise<RAKMessage[]>`
- SQL: `WHERE (to_agent = ? OR to_agent = '*') [AND status = ?] ORDER BY created_at DESC LIMIT 100`
- Supabase 复合 OR: 使用 `.or(`to_agent.eq.${agentId},to_agent.eq.*`)` 语法
- 可选 status 过滤: `.eq('status', status)` 仅当 status 存在时
- `.order('created_at', {ascending:false}).limit(100)`

#### 3.4 `updateMessageStatus` 函数
- 改为 `export async function updateMessageStatus(id: string, status: string): Promise<void>`
- 构建 update 对象: { status, delivered_at?: now }
- 调用: `await sb.from('rak_messages').update(updateObj).eq('id', id)`

#### 3.5 `saveDAGNode` 函数
- 改为 `export async function saveDAGNode(...): Promise<DAGNode>`
- INSERT rak_dag_nodes: 字段映射 taskId→task_id, assignedAgent→assigned_agent, dependencies→JSON, config→JSON
- 返回: `await getDAGNode(data.id, data.taskId)`

#### 3.6 `getDAGNode` 函数
- 改为 `export async function getDAGNode(id: string, taskId: string): Promise<DAGNode | null>`
- 查询: `await sb.from('rak_dag_nodes').select('*').eq('id', id).eq('task_id', taskId).maybeSingle()`
- 手动映射到 DAGNode 类型

#### 3.7 `getDAGForTask` 函数
- 改为 `export async function getDAGForTask(taskId: string): Promise<DAGNode[]>`
- 查询: `await sb.from('rak_dag_nodes').select('*').eq('task_id', taskId).order('id')`

#### 3.8 `updateDAGNodeStatus` 函数
- 改为 `export async function updateDAGNodeStatus(id: string, taskId: string, status: string, result?: unknown): Promise<void>`
- 构建 update 对象: status, started_at?, completed_at?, result?
- 调用: `.update(updateObj).eq('id', id).eq('task_id', taskId)`

---

## 文件 4: `lib/repositories/evolution.repository.ts`

### 改动点

#### 4.1 import 变更
- `import { getDb } from "../db";` → `import { getSupabase } from "../db";`

#### 4.2 `getEvolutionRecords` 函数
- 改为 `export async function getEvolutionRecords(...): Promise<PaginatedResult<EvolutionRecord>>`
- 调用 `await paginatedQuery<EvolutionRow>(...)`

#### 4.3 `getEvolutionById` 函数
- 改为 `export async function getEvolutionById(id: string): Promise<(EvolutionRecord & { beforeMetrics?: EvolutionRecord["metrics"] }) | null>`
- 查询: `await sb.from('evolution_records').select('*').eq('id', id).maybeSingle()`

#### 4.4 `createEvolution` 函数
- 改为 `export async function createEvolution(...): Promise<EvolutionRecord>`
- INSERT: id, stage, title, description, agent_id=data.agentId, status='in_progress'

#### 4.5 `updateEvolution` 函数
- 改为 `export async function updateEvolution(...): Promise<EvolutionRecord | null>`
- 如果 status 变更为 success/failed，需要先查询当前 metrics 存为 before_metrics
  - `const current = await sb.from('evolution_records').select('metrics').eq('id', id).maybeSingle()`
- 构建完整 update 对象后执行更新

#### 4.6 `getEvolutionTrend` 函数
- 改为 `export async function getEvolutionTrend(months = 6): Promise<{ labels: string[]; data: number[] }>`
- **难点**: 原 SQL 使用 `strftime('%Y-%m', completed_at)` 进行按月分组聚合
- Supabase 方案:
  - 方案A: 拉取所有 completed_at IS NOT NULL 的记录到内存中手动按月分组统计（数据量不大时可行）
  - 方案B: 使用 Supabase 的 `.rpc()` 调用数据库函数（需要提前创建，不在本次改造范围）
- **采用方案A**: 
  1. `await sb.from('evolution_records').select('completed_at, status').not('completed_at', 'is', null)`
  2. 内存中按 `YYYY-MM` 分组统计 total 和 success
  3. 整体 COUNT 查询:
     - total: `const { count: totalAll } = await sb.from('evolution_records').select('*', {count:'exact', head:true})`
     - success: `const { count: successAll } = await sb.from('evolution_records').select('*', {count:'exact', head:true}).eq('status', 'success')`

---

## 通用注意事项

1. **时间戳处理**: sql.js 中使用 `datetime('now')`，Supabase 中使用 JS `new Date().toISOString()` 或 `now()`（需 Supabase 支持）
2. **JSON 字段**: 保持 `JSON.stringify()` 不变，Supabase 会自动处理
3. **复合主键 upsert**: task_steps 表如果用 upsert，onConflict 传 `['id','task_id']`
4. **maybeSingle() vs single()**: 
   - 可能不存在的用 `maybeSingle()`（返回 data 可能为 null）
   - 确定存在的用 `single()`
5. **范围分页**: Supabase `.range(from, to)` 从 0 开始，inclusive，from=(page-1)*pageSize, to=page*pageSize-1
6. **OR 查询语法**: Supabase `.or('column.eq.value,column.eq.value2')` 字符串语法

---

## 改造步骤（执行顺序）
1. base.ts - paginatedQuery
2. task.repository.ts
3. rak.repository.ts
4. evolution.repository.ts
5. 类型检查
