/**
 * 后端微内核启动器（M0/M1）
 *
 * 内核只做三件事（dsh 理念，不含任何 Agent 业务逻辑）：
 *   1. 插件生命周期：加载 / 启动 / 热卸载，卸载时自动执行 disposers（可逆副作用）
 *   2. 声明式依赖注入：插件 `inject: ['service']` 声明所需 Service，内核按拓扑序启动
 *   3. 全局事件总线 + Service：插件间只经事件与服务通信，禁止直接 import 彼此
 *
 * 实现基于 vendor Cordis 4.0（Koishi 内核，MIT）—— 见 ./vendor/cordis
 */
import { Context } from './vendor/cordis'
import { AIModelService } from './plugins/model-adapter'
import { ToolsService } from './plugins/tool-registry'
import { MastraEngineService } from './plugins/mastra-engine'
import { PiSubagentService } from './plugins/pi-subagent'
import { SpecStoreService } from './plugins/spec-store'

export { Context, Service } from './vendor/cordis'
export type { Plugin } from './vendor/cordis'
export { AIModelService } from './plugins/model-adapter'
export { ToolsService } from './plugins/tool-registry'
export { MastraEngineService } from './plugins/mastra-engine'
export { PiSubagentService } from './plugins/pi-subagent'
export { SpecStoreService } from './plugins/spec-store'

/** 创建全新内核实例（每次调用得到独立作用域树）。 */
export function createKernel(): Context {
  return new Context()
}

const g = globalThis as unknown as { __serverKernel?: Promise<Context>; __serverKernelV?: number }

/**
 * 进程级后端内核单例（Next dev 热重载安全）。
 * 插件集：model-adapter / tool-registry / mastra-engine / pi-subagent。
 * KERNEL_VERSION 守卫：插件集变更时 +1，dev HMR 下 globalThis 旧单例自动重建。
 * 注意必须 async：cordis Service 的 provide 在 fiber 启动（微任务后）才挂上 ctx，
 * await 插件 fiber 确保调用方拿到内核时全部 service 已就绪。
 */
const KERNEL_VERSION = 4

export function getKernel(): Promise<Context> {
  if (!g.__serverKernel || g.__serverKernelV !== KERNEL_VERSION) {
    const ctx = createKernel()
    g.__serverKernelV = KERNEL_VERSION
    g.__serverKernel = (async () => {
      await ctx.plugin(AIModelService)
      await ctx.plugin(ToolsService)
      await ctx.plugin(MastraEngineService)
      await ctx.plugin(PiSubagentService)
      await ctx.plugin(SpecStoreService)
      return ctx
    })()
  }
  return g.__serverKernel
}
