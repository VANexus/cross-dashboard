# real-brain.ts await 添加实施计划

## 修改目标
在 `x:\xrak\yuz\cross-dashboard\lib\agent-runtime\real-brain.ts` 中，为所有 `isDemoMode()` 和 `getAIProvider()` 调用添加 `await`。

## 需要修改的 6 处位置

### 1. think 方法（2处）
- **第89行**：`if (isDemoMode())` → `if (await isDemoMode())`
- **第93行**：`await getAIProvider().analyze<AgentThought>({` → `(await getAIProvider()).analyze<AgentThought>({`（注意括号优先级）

### 2. decide 方法（2处）
- **第108行**：`if (isDemoMode())` → `if (await isDemoMode())`
- **第112行**：`await getAIProvider().analyze<AgentDecision | null>({` → `(await getAIProvider()).analyze<AgentDecision | null>({`

### 3. reflect 方法（2处）
- **第124行**：`if (isDemoMode())` → `if (await isDemoMode())`
- **第128行**：`await getAIProvider().generate({` → `(await getAIProvider()).generate({`

## 约束条件
- 不改函数签名（已为 async）
- 不改业务逻辑
- 不加注释
- 直接覆盖原文件
