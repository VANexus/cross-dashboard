# FlowMind × XRAK 集群接入手册（P0 脚手架）

> 架构真源：`docs/architecture/2026-09-03-cluster-native-service-architecture.md`
> 集群纪律真源：`rak-infra` skill（`/home/xrak/rak-cluster.md`）+ Vaultwarden「rak 集群」folder

## 三服务一图流

| 服务 | GitLab group/ns | Harbor 项目 | 域名 | 状态 |
|---|---|---|---|---|
| flowmind | `core-ui` | core-ui（需新建，与 ns 同名映射） | `flowmind.xrak.top`（xrak-wildcard-tls） | P0 可接 |
| flowmind-api | `core-api`（P2） | core-api | `flowmind.api.xrak.top` 预留；浏览器走同源 `/api` | P2 启用 |
| flowmind-mcp | `core-api`（rak-flowmind 仓库） | core-api | **仅内网**（auth 模型 v2·内部专属，无公网路由） | P3 启用 |

## 首次接入清单（flowmind，标准接入流程 A）

1. **GitLab 项目**：group 三选一纪律 → 建 `core-ui/flowmind`（用用户 PAT，rak-init.sh）；Harbor 建同名项目 `core-ui` + 项目级 robot（push/pull，duration=-1）。
2. **GitHub secrets**（VANexus/cross-dashboard）：`GITLAB_URL`（含 PAT 的 https 串）+ `GITLAB_PROJECT=core-ui/flowmind` → 触发 sync-to-gitlab。
3. **GitLab CI 变量**：
   - `HARBOR_CONFIG_B64`（**普通变量**）= `base64 -w0 ~/.docker/config.json`（robot 凭据）。⚠ 禁 file 型：robot 名含 `$`，runner 展开吞段 → 401（2026-09-02 实证）。
   - `AGOCD_TOKEN`（masked）= 有 api 权限的 GitLab PAT。
4. **argocd-apps 落位**：把 `deploy/gitops/flowmind/` 里 rollout/analysis/service(-canary)/ingressroute 复制为 `apps/flowmind/`，`application.yaml` 放 `argocd/apps/flowmind.yaml`；rollout 的 image tag 初值给一个已构建的 SHA（禁止长期 `:placeholder`）。
5. **验证门**：ArgoCD Synced → Rollout Healthy → `curl https://flowmind.xrak.top` 200 → 故意发一个坏 tag 走 analysis 自动回滚演练。

## Secret 与环境变量（运行时零填写）

端点解析优先级：`显式 env 覆盖 > 运行形态自动检测（KUBERNETES_SERVICE_HOST）> lib/cluster 目录默认`。

### flowmind-api / flowmind-mcp 需要的 Secret（P2/P3 建立）

```yaml
# kubectl -n core-api create secret generic flowmind-api-env（值来自 Vaultwarden）
PGUSER=flowmind
PGPASSWORD=<Vaultwarden: flowmind-pg>
REDIS_PASSWORD=<rak-infra CREDENTIALS: database/db-credentials>
LITELLM_MASTER_KEY=<agentic/litellm-env MASTER_KEY>
S3_ACCESS_KEY / S3_SECRET_KEY=<MinIO 服务账号（勿用 root）>
# 可选覆盖（默认走目录）：FLOWMIND_MCP_URL / PGHOST / AI_LLM_BASE_URL / RAK_MESH_HOST
```

```yaml
# flowmind-mcp-env（rak-flowmind 侧云密钥唯一持有者，P3）
TIKHUB_API_KEY / ALIBABA_APP_KEY / ALIBABA_APP_SECRET / LONGCAT_API_KEY(或 LiteLLM) / 生图 key / FEISHU_WEBHOOK_URL ...
```

### 开发机（Windows）`.env`

同一份 key 名写工作区根 `.env` 即可（`next.config.ts` 已自动加载）；`RAK_RUNTIME` 不设置=自动 dev。

## 数据层初始化（P1 前执行）

```bash
# 在 rak-core 上：建库 + 授权（密码先入 Vaultwarden 再执行）
bash ~/.agents/skills/rak-infra/scripts/rak-db-init.sh flowmind flowmind
# 连接验证（开发机经 mesh）：psql -h 100.121.213.4 -p 30432 -U flowmind -d flowmind
# schema：P1 将 supabase/migrations/*.sql 转普通 PG DDL 放 db/migrations/ 后
#   scripts/migrate.ts 幂等执行；数据 pg_dump --no-privileges --no-owner 一次灌入
```

## 待核实的两个端点（不阻塞 P0）

- LiteLLM 开发机入口：集群内 `litellm.agentic.svc:4000` 已定；mesh NodePort 未核实 → `sudo k3s kubectl -n agentic get svc | grep litellm` 核实后回填 `lib/cluster/services.ts` 或开发机设 `AI_LLM_BASE_URL`。
- flowmind-mcp 服务化后的 mesh 暴露（若开发机想直连集群版）：默认给本机 127.0.0.1:8001，需要时加 NodePort 再设 `FLOWMIND_MCP_URL`。

## P2/P3 切流开关（都在 git 里改，禁手改集群）

- P2：`deploy/gitops/flowmind/ingressroute.yaml` 解注释 `/api` 路由（priority 20 + ratelimit + nocompress），同步 argocd-apps；观察后删除 Next `app/api` 已迁移域。
- P3：解注释 `/backend-mcp` 路由 → flowmind-mcp.core-api:8001；建 `apps/flowmind-mcp/` 五件套（**无** IngressRoute 公网入口）。
