# 批量修正 service 调用缺少 await 计划

## 改动汇总
共 9 个文件需要修改，13 处改动点（12 处加 await，1 处加 .catch）

---

### 1. app/api/memory/route.ts (3 处加 await)
- **L13**: `const result = service.list(...)` → `const result = await service.list(...)`（消费返回值，赋值左值）
- **L20**: `return success(result.items, result.pagination)` → result 必须是 resolved 的 Promise，所以 L13 必须 await
- **L26**: `const entry = service.create(parsed.data)` → `const entry = await service.create(parsed.data)`（赋值左值）

### 2. app/api/memory/[id]/route.ts (3 处加 await)
- **L12**: `const entry = service.getById(id)` → `const entry = await service.getById(id)`（赋值左值）
- **L22**: `const entry = service.update(id, parsed.data)` → `const entry = await service.update(id, parsed.data)`（赋值左值）
- **L30**: `const ok = service.delete(id)` → `const ok = await service.delete(id)`（赋值左值）

### 3. app/api/memory/[id]/usage/route.ts (1 处加 await)
- **L11**: `const usage = service.getUsage(id)` → `const usage = await service.getUsage(id)`（赋值左值）

### 4. app/api/workflows/video-localization/tasks/[id]/download/route.ts (1 处加 await)
- **L18**: `const url = service.getDownloadUrl(id, file)` → `const url = await service.getDownloadUrl(id, file)`（赋值左值）

### 5. app/api/b2b/products/route.ts (1 处加 await)
- **L10**: `return success(service.getProducts())` → `return success(await service.getProducts())`（直接作为 success(data) 参数）

### 6. app/api/b2b/longtail/route.ts (1 处加 await)
- **L12**: `return success(industry ? service.getLongtail(industry) : [])` → `return success(industry ? await service.getLongtail(industry) : [])`（直接作为 success(data) 参数）

### 7. app/api/crawler/results/route.ts (1 处加 await)
- **L11**: `const results = service.getRecentResults(limit)` → `const results = await service.getRecentResults(limit)`（赋值左值）

### 8. app/api/crawler/extract/route.ts (1 处加 .catch)
- **L23**: `service.saveResult(result)` → `service.saveResult(result).catch(console.error)`（fire-and-forget，单独一行无 return 无左值）

### 9. 其他文件（无需改动，已验证）
- app/api/workflows/video-localization/route.ts: getTasks 已 await ✓
- app/api/workflows/video-localization/tasks/[id]/route.ts: getTask/cancelTask 已 await ✓
- app/api/workflows/video-localization/tasks/[id]/retry/route.ts: retryTask 已 await ✓
- app/api/workflows/video-localization/health/route.ts: getHealth 已 await ✓
- app/api/workflows/video-localization/batch/route.ts: submitBatch 已 await ✓
- app/api/b2b/recommend/route.ts: recommend 已 await ✓
- app/api/crawler/stores/route.ts: getStatus 已 await ✓
- app/api/crawler/screenshot/route.ts: screenshot 已 await ✓
