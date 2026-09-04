/**
 * model-adapter 插件 —— provide: `aiModel` service
 *
 * 统一模型接入出口：包装 lib/ai 的 getAISDKModel（AI_LLM_* env / Supabase ai_config /
 * 内置默认值三级优先）。AIConfigError 原样向上抛出，路由层保持既有错误处理。
 * 动态 import 保持弱依赖：插件加载时不拉起 lib/ai 模块图。
 */
import { Context, Service } from '../vendor/cordis'
import type { LanguageModel } from 'ai'

declare module '../vendor/cordis/context' {
  interface Context {
    aiModel: AIModelService
  }
}

export class AIModelService extends Service {
  static provide = 'aiModel'

  constructor(ctx: Context) {
    super(ctx, 'aiModel')
  }

  /** 解析当前 AI 配置 → AI SDK LanguageModel（配置缺失时抛 AIConfigError）。 */
  async get(): Promise<LanguageModel> {
    const { getAISDKModel } = await import('@/lib/server/ai')
    return getAISDKModel()
  }
}
