/**
 * FlowMind — 协议适配器接口
 *
 * 每种后端协议实现此接口，把后端特有的发现格式映射到统一的
 * ServiceManifest。前端只依赖 ProtocolAdapter，不感知具体协议。
 *
 * 新增协议（如 gRPC / WoT）只需加一个适配器，无需改前端核心。
 */
import type {
  ServiceEndpoint,
  ServiceManifest,
  SkillExecutionRequest,
  SkillExecutionResult,
} from "./types";

export interface ProtocolAdapter {
  /** 协议标识 */
  readonly protocol: ServiceEndpoint["protocol"];

  /**
   * 发现服务：连接后端，获取技能清单，返回规范化 manifest。
   * 失败时返回 health="unreachable" 的 manifest（不抛错），
   * 保证前端能优雅展示断连状态。
   */
  discover(endpoint: ServiceEndpoint): Promise<ServiceManifest>;

  /**
   * 执行技能：按协议调用后端的技能。
   * 返回规范化的 SkillExecutionResult。
   */
  execute(request: SkillExecutionRequest): Promise<SkillExecutionResult>;

  /**
   * 健康探针：快速检测后端是否可达。
   * 用于注册表的定期探活。
   */
  ping(endpoint: ServiceEndpoint): Promise<boolean>;
}

/** 适配器工厂：按协议分发 */
export type AdapterFactory = (endpoint: ServiceEndpoint) => ProtocolAdapter;
