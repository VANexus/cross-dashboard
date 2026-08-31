# Service 层 Repository 调用 async/await 改造计划

## 目标
为 `x:\xrak\yuz\cross-dashboard\lib\services\` 目录下 12 个 Service 文件中所有 Repository 调用添加 `async/await`，修复 fire-and-forget Promise rejection 风险。

---

## 文件逐一分析与修改方案

### 1. agent.service.ts
**Repo 调用点：** `repo.*` (agent.repository)

| 行号 | 函数 | 当前代码 | 修改方案 |
|------|------|----------|----------|
| 12-14 | `list()` | `return repo.getAgents(filters)` | 加 `async`，返回 `Promise<Agent[]>`，`return await repo.getAgents(filters)` |
| 16-18 | `getById()` | `return repo.getAgentById(id)` | 加 `async`，返回 `Promise<(Agent & { subAgents: SubAgent[] }) \| null>`，`return await repo.getAgentById(id)` |
| 20-23 | `heartbeat()` | `repo.updateAgentHeartbeat(id)` (fire-and-forget) | 加 `async`，改成 `repo.updateAgentHeartbeat(id).catch(console.error)`，this.rak 调用保持不变 |
| 25-28 | `updateStatus()` | `repo.updateAgentStatus(id, status)` (fire-and-forget) + `return repo.getAgentById(id)` | 加 `async`，返回 `Promise<Agent \| null>`，第一行 `.catch(console.error)`，第二行 `return await repo.getAgentById(id)` |
| 30-43 | `spawnSubAgent()` | `const parent = repo.getAgentById(parentId)` + `const sub = repo.createSubAgent(...)` | 加 `async`，返回 `Promise<SubAgent \| null>`，两个 const 前加 `await` |

---

### 2. task.service.ts
**Repo 调用点：** `repo.*` (task), `agentRepo.*`, `journalRepo.*`, `memoryRepo.*`

| 行号 | 函数 | 修改方案 |
|------|------|----------|
| 16-23 | `list()` | async + Promise 返回类型 + `return await repo.getTasks(filters)` |
| 25-27 | `getById()` | async + `return await repo.getTaskById(id)` |
| 29-59 | `create()` | async + `const task = await repo.createTask(data)`，rak 调用不变 |
| 61-88 | `update()` | async + `const task = await repo.updateTask(id, data)` |
| 90-92 | `delete()` | async + `return await repo.deleteTask(id)` |
| 94-106 | `updateStep()` | async + `const step = await repo.updateTaskStep(taskId, stepId, data)` |
| 108-153 | `onTaskCompleted()` (private) | 加 `async`；agentRepo.getAgentById/agentRepo.updateAgentStats/journalRepo.addEntry/memoryRepo.createMemory 分别加 `await`（原 try/catch 保留）；调用处 `this.onTaskCompleted(task)` 改成 `this.onTaskCompleted(task).catch(console.error)` |

---

### 3. memory.service.ts
**Repo 调用点：** `repo.*` (memory.repository)

全部 7 个方法 (`list`, `getById`, `create`, `update`, `delete`, `getUsage`)：加 `async`，返回类型包 `Promise<>`，所有 `return repo.XXX()` 改为 `return await repo.XXX()`。

---

### 4. evolution.service.ts
**Repo 调用点：** `repo.*` (evolution), `journalRepo.*`, `memoryRepo.*`

| 行号 | 函数 | 修改方案 |
|------|------|----------|
| 12-19 | `list()` | async + Promise + await |
| 21-23 | `getById()` | async + await |
| 25-32 | `create()` | async + await |
| 34-43 | `update()` | async + `const record = await repo.updateEvolution(id, data)`；`this.onEvolutionSuccess(record)` → `.catch(console.error)` |
| 45-47 | `getTrend()` | async + `return await repo.getEvolutionTrend(months)` |
| 49-82 | `onEvolutionSuccess()` (private) | 加 `async`；memoryRepo.createMemory + journalRepo.addEntry 前加 `await`（try/catch 保留） |

---

### 5. workflow.service.ts
**Repo 调用点：** `repo.*` (workflow.repository)

#### 只读（get*）方法：全部 async + Promise + await
- `getDataSources()` (27-29)
- `getProductKeywords()` (31-33)
- `getPainPoints()` (35-37)
- `getRecentResearchResults()` (39-41)
- `getImages()` (86-88)
- `updateImage()` (90-92) → 返回 Promise<GeneratedImg \| null>
- `getStoryboardFrames()` (94-96)
- `getAdKeywords()` (153-155)
- `updateAdKeyword()` (157-159) → 返回 Promise<AdKeyword \| null>
- `getAdPositions()` (161-163)
- `getRecentAdAnalyses()` (169-171)
- `getCategoryRecs()` (227-229)
- `getBulletPoints()` (231-233)
- `getInfringementWords()` (235-237)
- `getRecentListingResults()` (239-241)
- `getInventoryItems()` (296-302)
- `getRestockSuggestions()` (304-306)
- `getRecentRestockOrders()` (339-341)
- `getCompetitorKeywords()` (355-357)
- `getCompetitors()` (359-361)
- `getRecentCompetitorAnalyses()` (363-365)
- `getWorkflowStatuses()` (397-399)

#### async 方法内部的 fire-and-forget repo 调用：加 `.catch(console.error)`
- `executeResearch()` L70-74: `repo.insertResearchResult({...}).catch(console.error)`
- `generateImage()` L132-141: forEach 内 `repo.insertImage({...}).catch(console.error)`
- `analyzeAdKeyword()` L191-194: `repo.insertAdAnalysis({...}).catch(console.error)`
- `generateListing()` L259-271: `repo.insertListingResult({...}).catch(console.error)`
- `generateRestockSuggestions()` L314: `const inventory = await repo.getInventoryItems(...)`
- `createRestockOrder()` L349: `repo.insertRestockOrder({...}).catch(console.error)`；函数加 async
- `analyzeCompetitor()` L380-385: `repo.insertCompetitorAnalysis({...}).catch(console.error)`
- `bumpWorkflowStatus()` (401-413): 加 async；`const current = (await repo.getWorkflowStatuses()).find(...)`；`await repo.updateWorkflowStatus(...)`；调用处 bumpWorkflowStatus 全部加 `.catch(console.error)`（共 12 处调用）

---

### 6. localize.service.ts
**Repo 调用点：** `repo.*` (localize.repository)

| 行号 | 函数 | 修改方案 |
|------|------|----------|
| 137-148 | `submitBatch()` forEach 内 | `repo.insertTask({...}).catch(console.error)`（原在 forEach 中 fire-and-forget） |
| 177-207 | `getTasks()` | L178: `const tasks = await repo.getTasks()`；L193: `repo.updateTaskStatus(...)` 无返回 → `.catch(console.error)`；L201: 同；L206: `return await repo.getTasks()` |
| 210-231 | `getTask()` | L211: `const task = await repo.getTask(id)`；L217/226: `.catch(console.error)`；L230: `return await repo.getTask(id)` |
| 234-255 | `cancelTask()` | L243: `repo.updateTaskStatus(...).catch(console.error)` |
| 258-296 | `retryTask()` | L265: `const original = await repo.getTask(id)`；L274: `repo.insertTask({...}).catch(console.error)` |

---

### 7. risk.service.ts
**Repo 调用点：** `repo.*` (risk.repository)

全部 7 个方法 (`listEvents`, `createEvent`, `resolveEvent`, `getHealth`, `getIsolationItems`, `updateIsolation`)：加 `async`，返回类型包 `Promise<>`，所有 repo 调用加 `await`。

---

### 8. content.service.ts
**Repo 调用点：** 直接 import 自 content.repository、workflow.repository、localize.repository

| 行号 | 函数 | 修改方案 |
|------|------|----------|
| 55-57 | `getIdeas()` | async + `return await getIdeas(platform)` |
| 59-61 | `getHotTopics()` | async + `return await getHotTopics(platform)` |
| 63-65 | `getRules()` | async + `return await getRulesByPlatform(platform)` |
| 68-73 | `getWorks()` | async + `drafts: await getDrafts(50)` + `videos: (await getTasks()).filter(...)` |
| 77-100 | `generateIdeas()` | 内部 L90: `insertIdea({...}).catch(console.error)` |
| 104-135 | `fetchHotTopics()` | L105: `const cached = await this.getHotTopics(input.platform)`；L117: `this.safePersistHotTopics(...)` → 原 safePersist 内部也要 async |
| 139-160 | `generateCopy()` | L153: `await insertDraft(...)`；L154: `const draft = await getDraft(id)` |
| 164-181 | `auditDraft()` | L165: `const draft = await getDraft(input.id)`；L176: `this.safeUpdateDraft(...)` 保持 |
| 185-204 | `generateImages()` | L197-199: `await this.safeUpdateDraft(...)` 内部用 await；getDraft 加 await |
| 208-213 | `updateDraft()` | async；L209: `await getDraft(id)`；L211: `await updateDraft(id, data)`；L212: `return await getDraft(id)` |
| 215-217 | `removeDraft()` | async + `return await deleteDraft(id)` |
| 222-235 | `safePersistHotTopics()` (private) | async；L224: `await clearHotTopics(platform)`；L226: `await insertHotTopic({...})` |
| 238-244 | `safeUpdateDraft()` (private) | async；L240: `await updateDraft(id, data)` |
| 265-278 | `bump()` (private) | async；L267: `const current = (await getWorkflowStatuses()).find(...)`；L274: `await updateWorkflowStatus(...)`；所有调用 bump 的地方加 `.catch(console.error)` |

---

### 9. b2b.service.ts
**Repo 调用点：** 直接 import 自 b2b.repository、workflow.repository

#### 只读方法：全部 async + Promise + await
- `getKeywordTrends()` (35-37)
- `getLongtail()` (89-91)
- `getProducts()` (117-119)
- `getListings()` (178-180)
- `getImageSkills()` (234-236)

#### 其他方法：
| 行号 | 函数 | 修改方案 |
|------|------|----------|
| 39-85 | `fetchKeywordTrends()` | L40: `const cached = await getKeywordTrends(input.platform)`；safePersist 内部 async + await |
| 93-113 | `generateLongtail()` | safePersistLongtail 内部 async + await |
| 121-148 | `fetchProducts()` | L122: `const cached = await getProducts()`；safePersistProducts 内部 async + await |
| 152-174 | `recommend()` | L157: `const products = await getProducts()` |
| 182-208 | `generateListing()` | L185: `const product = await getProduct(input.productId)`；L197: `await insertListing(...)`；L202: `const draft = await getListing(id)` |
| 210-230 | `publishListing()` | L211: `const draft = await getListing(input.listingId)`；L214: `await updateListing(...)`；L222/225: `await updateListing(...)` |
| 246-257 | `createImageSkill()` | async；L250: `await insertImageSkill(...)`；L254: `const skill = await getImageSkill(id)` |
| 259-263 | `updateImageSkill()` | async；L260: 两次 `await getImageSkill(id)`；L261: `await updateImageSkill(id, data)` |
| 265-286 | `generateWithSkill()` | L266: `const skill = await getImageSkill(input.skillId)`；L281: `await incrementImageSkillUsage(skill.id)` |
| 290-301 | `safePersistKeywordTrends()` | async；内部 clear/insert 加 await |
| 303-312 | `safePersistLongtail()` | async；内部 clear/insert 加 await |
| 314-319 | `safePersistProducts()` | async；内部 clearProduct/insertProduct 加 await |
| 321-332 | `bump()` | async；L323: `(await getWorkflowStatuses()).find(...)`；L330: `await updateWorkflowStatus(...)`；所有 bump 调用加 `.catch(console.error)` |

---

### 10. dashboard.service.ts
**Repo 调用点：** `agentRepo.*`, `taskRepo.*`, `riskRepo.*`, `workflowRepo.*`

| 行号 | 函数 | 修改方案 |
|------|------|----------|
| 18-36 | `getStats()` | async；L19: `const agents = await agentRepo.getAgents()`；L20: `const tasks = await taskRepo.getTasks(...)`；L21: `const risks = await riskRepo.getRiskEvents({})`；返回 `Promise<DashboardStats>` |
| 154-163 | `getAlerts()` | async；L155: `const risks = await riskRepo.getRiskEvents({ resolved: false })`；返回 `Promise<Alert[]>` |
| 165-167 | `getWorkflowStatuses()` | async + `return await workflowRepo.getWorkflowStatuses()` |
| 217-226 | `getDashboardData()` | async；内部所有 this.* 调用加 await |

注：getSystemMetrics/getBusinessMetrics/getTrends 使用的是 db.query() 非 repo 调用，保持不变。

---

### 11. crawler.service.ts
**分析：** 该文件未 import 任何 repository，仅使用 `getDb()` 直接执行 SQL。无 repo.* 调用，**无需修改**。

---

### 12. index.ts
**分析：** 仅 barrel export，无 repo 调用，**无需修改**。

---

## 执行顺序
按用户列表 1-12 顺序逐一重写文件：
1. agent.service.ts
2. task.service.ts
3. memory.service.ts
4. evolution.service.ts
5. workflow.service.ts
6. localize.service.ts
7. risk.service.ts
8. content.service.ts
9. b2b.service.ts
10. dashboard.service.ts
11. crawler.service.ts（无修改）
12. index.ts（无修改）

## 修改原则（严格遵守）
- 只改 Repository 调用相关代码，**绝不改其他业务逻辑**
- 不加注释
- Fire-and-forget 统一用 `.catch(console.error)` 或语义等效的最短形式
- 函数有 repo 调用且 consume 返回值 → 加 async + Promise 返回类型 + await
