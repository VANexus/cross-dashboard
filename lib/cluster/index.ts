/**
 * FlowMind — 集群零配置底座统一出口
 *
 * 用法（服务端）：
 *   import { flowmindMcpUrl, resolveUrl, publicServiceView } from "@/lib/cluster";
 *
 * 纪律：任何基础设施端点/凭据解析必须经过本模块；业务代码不得自带 URL/key 默认值。
 */
export * from "./runtime";
export * from "./services";
