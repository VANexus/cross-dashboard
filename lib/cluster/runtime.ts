/**
 * FlowMind — 集群运行时检测（零配置底座）
 *
 * 设计文档：docs/architecture/2026-09-03-cluster-native-service-architecture.md §3
 *
 * 两种形态：
 *   cluster  跑在 XRAK k3s 内（core-ui / core-api ns）→ 端点走集群内 svc DNS
 *   dev      开发机（本机或 mesh 内笔记本）→ 端点走 mesh NodePort / 本机回环
 *
 * 判定：RAK_RUNTIME 显式钉死优先；否则 KUBERNETES_SERVICE_HOST 存在 ⇒ cluster。
 * 注意 Next.js 双运行时：本模块只在**服务端**消费；浏览器永远通过
 * /api/cluster/services 拿脱敏视图，不直接接触集群内网地址。
 */

export type ClusterMode = "cluster" | "dev";

/** 当前运行形态（每次读取，便于测试时 env 注入）。 */
export function clusterMode(): ClusterMode {
  const forced = process.env.RAK_RUNTIME?.trim().toLowerCase();
  if (forced === "cluster" || forced === "dev") return forced;
  return process.env.KUBERNETES_SERVICE_HOST ? "cluster" : "dev";
}

export function isCluster(): boolean {
  return clusterMode() === "cluster";
}

/** 开发机 mesh 入口（WireGuard 内网 IP，可 RAK_MESH_HOST 覆盖）。 */
export function meshHost(): string {
  return process.env.RAK_MESH_HOST?.trim() || "100.121.213.4";
}
