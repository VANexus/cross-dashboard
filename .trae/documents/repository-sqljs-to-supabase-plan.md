# Repository 层改造计划：sql.js → Supabase Query Builder

## 概述
将 3 个 Repository 文件从 sql.js (同步) 风格完整改写为 Supabase query builder (异步) 风格，保留函数签名 (除加 async)、保留 Row 接口 snake_case、保留 rowToT camelCase 映射。

---

## 文件 1：`lib/repositories/base.ts`

### 改动内容

| 项目 | 原代码 | 新代码 |
|------|--------|--------|
| import | `import { getDb } from "../db";` | `import { getSupabase } from "../db";` |
| paginatedQuery<T> 签名 | `export function paginatedQuery<T>(...): PaginatedResult<T>` | `export async function paginatedQuery<T>(...): Promise<PaginatedResult<T>>` |
| paginatedQuery 内部 | `const db = getDb();` | `const sb = getSupabase();` |
| count 语句 | `db.query("SELECT COUNT(*) as c FROM table WHERE ...").get(...)` | `const { count } = await sb.from(table).select('*', { count: 'exact', head: true }).[条件链]; total = count ?? 0` |
| items 语句 | `db.query("SELECT * FROM table WHERE ... ORDER BY ... LIMIT ? OFFSET ?").all(...)` | `await sb.from(table).select('*').[条件链].[order链].range(offset, offset + pageSize - 1)` |

**关键设计：where/params 解析**

原函数接受 `where: string` (如 `"WHERE 1=1 AND status = ?"`) 和 `params: unknown[]`。
由于要消除 SQL 字符串拼接，**重写 where 解析逻辑**：
- 用正则从 where 串中提取所有 `col = ?` / `col IS ?` 条件 (忽略 `WHERE 1=1`)
- 按 params 顺序依次 apply `.eq(col, params[i])` / `.is(col, params[i])`
- `orderBy: string` (如 `"rowid DESC"`, `"rank ASC, heat DESC"`) 解析为多次 `.order(col, { ascending: bool })`

**parseJsonField<T>**：保持原样不动。

---

## 文件 2：`lib/repositories/b2b.repository.ts` (263 行，5 张表)

### 统一改动
- import: `getDb → getSupabase`
- 每个函数加 `async`，返回值 `T → Promise<T>`
- 内部: `const db = getDb(); → const sb = getSupabase();`

### 逐函数改造表

#### wf_keyword_trends (3 函数)
| 函数 | SQL → Supabase |
|------|---------------|
| `clearKeywordTrends(platform)` | `DELETE FROM t WHERE platform = ?` → `sb.from("wf_keyword_trends").delete().eq("platform", platform)` 返回 Promise\<void\> |
| `insertKeywordTrend(t)` | `INSERT OR IGNORE INTO t (...) VALUES (?,?,?)` + `datetime('now')` → `sb.from(...).upsert({ id, platform, industry_id: t.industryId, ..., fetched_at: new Date().toISOString() }, { onConflict: "id", ignoreDuplicates: true })` |
| `getKeywordTrends(platform, limit=50)` | `SELECT word,heat,delta,rank,industry,source FROM t WHERE platform=? ORDER BY rank ASC, heat DESC LIMIT ?` → `sb.from(...).select('word,heat,delta,rank,industry,source').eq('platform', platform).order('rank',{ascending:true}).order('heat',{ascending:false}).limit(limit)` 返回 `.data as KeywordTrendRow[]` |

#### wf_longtail_keywords (3 函数)
| 函数 | SQL → Supabase |
|------|---------------|
| `clearLongtail(industry)` | DELETE + eq |
| `insertLongtail(t)` | INSERT OR IGNORE → upsert, search_intent snake_case |
| `getLongtail(industry, limit=50)` | SELECT + eq + order rowid (用 id 或去掉 rowid，直接 limit) + map snake→camel (searchIntent) |

#### wf_b2b_products (5 函数)
| 函数 | SQL → Supabase |
|------|---------------|
| `clearProducts()` | DELETE 全表 → `sb.from(...).delete().neq('id','')` (gte ' ' 也行，Supabase delete 必须有过滤) |
| `insertProduct(p)` | INSERT OR IGNORE，keywords JSON.stringify |
| `getProducts(limit=100)` | SELECT * + limit → `.select('*').limit(limit)` + map rowToProduct |
| `getProduct(productId)` | SELECT * WHERE product_id = ? → `.select('*').eq('product_id', productId).maybeSingle()`，返回 rowToProduct 或 null |

#### wf_b2b_listings (6 函数)
| 函数 | SQL → Supabase |
|------|---------------|
| `insertListing(l)` | INSERT OR IGNORE，upload_status 默认 'draft' |
| `getListings(limit=50)` | ORDER BY created_at DESC, rowid DESC → `.order('created_at',{ascending:false}).order('id',{ascending:false})` |
| `getListing(id)` | WHERE id = ? → `.eq('id', id).maybeSingle()` |
| `updateListing(id, data)` | 动态 SET → 构造 updatePayload: `{ upload_status?, uploaded_product_id?, image_url? }`，若空直接 return；`sb.from(...).update(updatePayload).eq('id', id)` |

#### wf_image_skills (6 函数)
| 函数 | SQL → Supabase |
|------|---------------|
| `insertImageSkill(s)` | INSERT OR IGNORE，style_tags JSON.stringify |
| `getImageSkills()` | ORDER BY usage_count DESC, rowid → `.order('usage_count',{ascending:false}).order('id')` |
| `getImageSkill(id)` | eq id + maybeSingle |
| `updateImageSkill(id, data)` | 动态 SET + updated_at: new Date().toISOString()，空 return |
| `incrementImageSkillUsage(id)` | UPDATE SET usage_count = usage_count + 1 → 先读后写：`const cur = await sb.from(...).select('usage_count').eq('id',id).single(); await sb.from(...).update({ usage_count: (cur.data?.usage_count ?? 0) + 1, updated_at: ... }).eq('id',id)` |

---

## 文件 3：`lib/repositories/workflow.repository.ts` (429 行，多模块)

### 统一改动
同上 (import、async、sb 替换)

### 逐函数改造表

#### 选品模块 (3 函数)
| 函数 | 改造要点 |
|------|----------|
| `getDataSources()` | SELECT * ORDER BY id → `.select('*').order('id')`；enabled 字段 number→bool (enabled===1) |
| `getProductKeywords(marketplace?)` | 可选 WHERE marketplace = ? → 有 marketplace 就 `.eq('marketplace', marketplace)`；supply_demand→supplyDemand，trend JSON 字段，ai_tag→aiTag |
| `getPainPoints()` | ORDER BY count DESC → `.order('count',{ascending:false})`；examples JSON |

#### AI 制图模块 (4 函数)
| 函数 | 改造要点 |
|------|----------|
| `getImages(type?)` | 可选 WHERE type = ?；ORDER BY created_at DESC；is_best:0/1→bool；revised_prompt null→undefined |
| `insertImage(img)` | INSERT；revisedPrompt ?? null |
| `updateImage(id, data)` | 动态 SET (is_best 0/1, clip_score, ctr_score, overall)；空则 select 单条 return；isBest: bool→0/1 |
| `getStoryboardFrames()` | ORDER BY sort_order；description→desc |

#### 广告模块 (3 函数)
| 函数 | 改造要点 |
|------|----------|
| `getAdKeywords(filters?)` | 可选 AND type = ? / AND tag = ? → 链 eq；trend JSON |
| `updateAdKeyword(id, data)` | 动态 SET (cpc, tag)；空则 select 单条 return |
| `getAdPositions()` | ORDER BY id；trend JSON |

#### 商品发布模块 (3 函数)
| 函数 | 改造要点 |
|------|----------|
| `getCategoryRecs()` | ORDER BY confidence DESC |
| `getBulletPoints()` | ORDER BY seo_score DESC；rufus 0/1→bool |
| `getInfringementWords()` | ORDER BY id |

#### 库存模块 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `getInventoryItems(filters?)` | 调 paginatedQuery（已经是 async）；where/params 构造同前；字段映射 snake→camel |
| `getRestockSuggestions()` | WHERE restock_qty > 0 → `.gt('restock_qty', 0)`；ORDER BY ratio_days ASC |

#### 竞品分析模块 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `getCompetitorKeywords(type?)` | 可选 WHERE type = ?；trend JSON |
| `getCompetitors()` | ORDER BY rank；sp_count/sb_count/sd_count → spCount/sbCount/sdCount |

#### 工作流状态模块 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `getWorkflowStatuses()` | ORDER BY id；last_run→lastRun, run_count→runs, success_rate→success |
| `updateWorkflowStatus(id, data)` | 动态 SET + updated_at 自动加；status/last_run/run_count/success_rate |

#### 生成结果：广告分析 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `insertAdAnalysis(data)` | INSERT；current_data/result_json JSON.stringify |
| `getRecentAdAnalyses(limit=10)` | ORDER BY created_at DESC + limit；result_json JSON.parse |

#### 生成结果：选品 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `insertResearchResult(data)` | INSERT；keywords/sources/result_json JSON.stringify |
| `getRecentResearchResults(limit=10)` | ORDER BY created_at DESC + limit |

#### 生成结果：上架 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `insertListingResult(data)` | INSERT；bullets/search_terms/result_json JSON |
| `getRecentListingResults(limit=10)` | ORDER BY created_at DESC + limit |

#### 生成结果：竞品分析 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `insertCompetitorAnalysis(data)` | INSERT；asins/keywords/result_json JSON |
| `getRecentCompetitorAnalyses(limit=10)` | ORDER BY created_at DESC + limit；asins JSON.parse |

#### 生成结果：补货订单 (2 函数)
| 函数 | 改造要点 |
|------|----------|
| `insertRestockOrder(data)` | INSERT；items JSON.stringify；total_items = data.items.length |
| `getRecentRestockOrders(limit=10)` | ORDER BY created_at DESC + limit；items JSON.parse；total_items→totalItems |

---

## 关键约束检查清单
- [x] 无任何 SQL 字符串拼接（所有条件通过 eq/gt/order/range 等 builder API）
- [x] 所有函数名、参数名、参数顺序 100% 保持
- [x] 所有 Row 接口 snake_case 保持
- [x] 所有 rowToT / 内联 map 的 camelCase 映射保持
- [x] parseJsonField 不动
- [x] insert/upsert 原返回 void → Promise\<void\>
- [x] DELETE 不返回值 (原 db.run → void → Promise\<void\>)
- [x] 无 `// removed` 或任何注释
- [x] fetched_at / updated_at / created_at 默认值：用 new Date().toISOString() (Supabase 自动处理如果列有 default，但 Repository 层保持一致手动传)
- [x] `datetime('now')` → `new Date().toISOString()`

---

## 执行步骤
1. 重写 base.ts（1 个 async 函数 + 保留 parseJsonField）
2. 重写 b2b.repository.ts（共 23 个函数 async 化）
3. 重写 workflow.repository.ts（共 30 个函数 async 化）
4. 每个文件单独验证 tsc 类型检查
5. 输出改动函数清单汇总
