'use client';

/**
 * 前端微内核启动器（M1）
 *
 * 浏览器端内核，复用 src/kernel/vendor/cordis 同构源码。挂载前端插件：
 *   - ui-actions    → provide: `actions`      UI 动作注册表（全局 + 页面）
 *   - page-context  → provide: `pageContext`  页面即上下文协议
 * globalThis 单例（Next dev 热重载安全）。
 */
import { Context } from '../../src/kernel/vendor/cordis'
import { ActionsService } from './plugins/ui-actions'
import { PageContextService } from './plugins/page-context'
import { ComponentKitService } from './plugins/component-kit'

export { Context, Service } from '../../src/kernel/vendor/cordis'
export type { Plugin } from '../../src/kernel/vendor/cordis'

/** 创建全新前端内核实例。 */
export function createClientKernel(): Context {
  return new Context()
}

const g = globalThis as unknown as {
  __webKernel?: Context
  __webKernelV?: number
  __webKernelReady?: Promise<Context>
}

/**
 * 前端内核版本：插件清单/服务形状变化时 +1，
 * 强制 HMR/旧 chunk 下的 globalThis 单例重建（旧实例缺新服务会静默 undefined）。
 */
const WEB_KERNEL_VERSION = 4

/** 浏览器端内核单例（应用生命周期内常驻）。 */
export function getClientKernel(): Context {
  if (!g.__webKernel || g.__webKernelV !== WEB_KERNEL_VERSION) {
    const ctx = createClientKernel()
    // cordis 插件启动是异步 fiber：服务在微任务后才挂上 ctx，
    // 立即读 ctx.actions/pageContext 是 undefined（竞速）——就绪 promise 见 whenKernelReady。
    const fibers = [
      ctx.plugin(ActionsService),
      ctx.plugin(PageContextService),
      ctx.plugin(ComponentKitService),
    ] as unknown as Promise<unknown>[]
    g.__webKernelReady = Promise.all(fibers).then(() => ctx)
    g.__webKernelV = WEB_KERNEL_VERSION
    g.__webKernel = ctx
  }
  return g.__webKernel
}

/**
 * 等待内核全部服务挂载后 resolve。
 * UI effect（动作/组件注册、页面上下文协议）必须经此接入，杜绝竞速读到 undefined 服务。
 */
export function whenKernelReady(): Promise<Context> {
  getClientKernel()
  return g.__webKernelReady ?? Promise.resolve(g.__webKernel!)
}

// 模块加载即预启动内核：cordis Service 在 fiber 启动（微任务后）才挂上 ctx，
// 提前创建确保任何 UI 调用（事件/effect）时 actions/pageContext 已就绪。
// 经微任务执行：模块图初始化完毕后再建单例，规避循环导入下的类 TDZ；
// 失败显式上抛到 console（而不是让调用方读到缺服务的内核静默炸掉）。
queueMicrotask(() => {
  try {
    getClientKernel()
  } catch (err) {
    console.error('[web-kernel] 预启动失败', err)
  }
})
