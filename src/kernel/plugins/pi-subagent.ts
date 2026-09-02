/**
 * pi-subagent 插件 —— provide: `pi` service，inject: ['tools']
 *
 * pi.dev SDK（@earendil-works/pi-coding-agent）作为长任务/多步深度子代理 harness：
 * - 自定义 provider 直连统一密钥架构（AI_LLM_*：claude 协议→anthropic-messages（Bearer 鉴权，
 *   与 LongCat 兼容层天然匹配）；openai 协议→openai-completions）
 * - SessionManager.inMemory()：会话不落盘，token 不设限（自带 auto-compaction）
 * - noTools: 'builtin'：关闭 bash/read/edit/write 危险工具，只留本插件注入的业务桥接工具
 *   （来自 tools service 白名单桥接：趋势/长尾/Listing/生图）
 * - 所有 pi import 均 server 端动态加载，不进 client bundle
 */
import { Type, type Static, type TSchema } from 'typebox'
import { Context, Service } from '../vendor/cordis'
import { AIConfigError } from '@/lib/ai'
import type { ToolsService } from './tool-registry'

declare module '../vendor/cordis/context' {
  interface Context {
    pi: PiSubagentService
  }
}

/** 桥接工具规范：pi 子代理可调用的业务工具白名单（TypeBox 参数 schema）。 */
interface BridgeToolSpec {
  name: string
  label: string
  description: string
  parameters: TSchema
  run: (tools: ToolsService, params: Record<string, unknown>) => Promise<unknown>
}

/** 业务工具桥接白名单（tools service 的 mastra 工具 → pi ToolDefinition）。 */
const BRIDGE_TOOLS: BridgeToolSpec[] = [
  {
    name: 'fetch_trends',
    label: '拉取平台趋势',
    description:
      '拉取跨境平台(TikTok/Instagram)关键词趋势热榜，返回词/热度/排名列表。IG 无关键词时自动按日轮换品类词池。',
    parameters: Type.Object({
      platform: Type.Union([Type.Literal('tiktok'), Type.Literal('instagram')], { description: '目标平台' }),
      industryId: Type.Optional(Type.Number({ description: '行业 ID（可选）' })),
    }),
    run: (tools, params) => tools.mastra.b2b_trends.execute!(params),
  },
  {
    name: 'fetch_longtail',
    label: '生成长尾关键词',
    description: '基于行业与种子词生成长尾关键词（B2B SEO 用）。',
    parameters: Type.Object({
      industry: Type.String({ description: '行业名，如 cross-border' }),
      seedKeywords: Type.Optional(Type.Array(Type.String(), { description: '种子关键词' })),
      limit: Type.Optional(Type.Number({ description: '数量上限，默认 20' })),
    }),
    run: (tools, params) => tools.mastra.b2b_longtail.execute!(params),
  },
  {
    name: 'generate_listing',
    label: '生成 Listing',
    description: '基于产品关键词生成优化的 Amazon Listing（标题/五点描述/搜索词）。',
    parameters: Type.Object({
      keyword: Type.String({ description: '产品核心关键词或名称' }),
      category: Type.Optional(Type.String({ description: '产品类目' })),
      language: Type.Optional(Type.Union([
        Type.Literal('en'), Type.Literal('zh'), Type.Literal('de'), Type.Literal('jp'),
      ], { description: '语言' })),
    }),
    run: (tools, params) => tools.mastra.listing_generate.execute!(params),
  },
  {
    name: 'generate_images',
    label: '营销生图',
    description: '按提示词生成 AI 营销/产品图，返回图片 URL 列表。',
    parameters: Type.Object({
      prompt: Type.String({ description: '图片生成提示词' }),
      aspectRatio: Type.Optional(Type.String({ description: '宽高比，如 1:1 / 3:4，默认 1:1' })),
      numVariants: Type.Optional(Type.Number({ description: '生成张数 1-4，默认 1' })),
    }),
    run: (tools, params) => tools.mastra.image_generate.execute!(params),
  },
]

/** pi 子代理事件摘要（deep-task SSE 透传给浏览器）。 */
export interface PiEventSummary {
  type: 'delta' | 'thinking' | 'tool_start' | 'tool_end' | 'done' | 'error'
  text: string
}

export interface SpawnOptions {
  onEvent?: (ev: PiEventSummary) => void
}

export class PiSubagentService extends Service {
  static provide = 'pi'
  static inject = ['tools']

  private tools: ToolsService

  constructor(ctx: Context) {
    super(ctx, 'pi')
    this.tools = ctx.tools
  }

  /**
   * 派发深度任务给 pi 子代理，流式回调事件，resolve 为最终文本摘要。
   * 任务期间模型可多轮调用桥接工具（趋势/长尾/Listing/生图）。
   */
  async spawn(task: string, opts: SpawnOptions = {}): Promise<string> {
    const { onEvent } = opts
    const emit = (ev: PiEventSummary) => {
      try {
        onEvent?.(ev)
      } catch {
        // 回调异常不中断子代理
      }
    }

    // ── 动态加载 pi SDK（仅 server 端，避免进 client bundle）──
    const pi = await import('@earendil-works/pi-coding-agent')

    // ── 统一密钥架构 → pi 自定义 provider ──
    const { getAIConfig } = await import('@/lib/ai')
    const config = await getAIConfig()
    if (!config.apiKey) throw new AIConfigError()
    const isAnthropic = config.provider === 'claude'
    const baseUrl = isAnthropic
      ? config.baseUrl.replace(/\/+$/, '')
      : config.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1'
    const api = isAnthropic ? 'anthropic-messages' : 'openai-completions'

    const modelRuntime = await pi.ModelRuntime.create({ modelsPath: null, refreshOnCreate: true })
    modelRuntime.registerProvider('flowmind', {
      baseUrl,
      // LongCat 兼容层要求 Bearer（x-api-key 单独会被拒）——authHeader=true 额外注入
      // Authorization: Bearer <key>，与 x-api-key 并存（lib/ai ClaudeAIProvider 同款修法）
      authHeader: true,
      models: [
        {
          id: config.model,
          name: config.model,
          api,
          baseUrl,
          reasoning: true,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128_000,
          maxTokens: 16_384,
        },
      ],
    })
    // 凭证必须走运行时凭证库（内存 overlay 不落盘；registerProvider 的 apiKey 字段不参与请求鉴权）
    await modelRuntime.setRuntimeApiKey('flowmind', config.apiKey)
    const model = modelRuntime.getModel('flowmind', config.model)
    if (!model) throw new Error(`pi 子代理模型不可用：${config.model}（provider=flowmind）`)

    // ── 桥接工具（TypeBox → ToolDefinition）──
    const customTools = BRIDGE_TOOLS.map((spec) =>
      pi.defineTool({
        name: spec.name,
        label: spec.label,
        description: spec.description,
        parameters: spec.parameters,
        execute: async (_toolCallId, params: Static<TSchema>) => {
          const result = await spec.run(this.tools, params as Record<string, unknown>)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            details: undefined,
          }
        },
      }),
    )

    // ── 会话：inMemory（不落盘）+ 禁用内置文件/命令工具 ──
    const { session } = await pi.createAgentSession({
      model,
      modelRuntime,
      sessionManager: pi.SessionManager.inMemory(),
      noTools: 'builtin',
      customTools,
      thinkingLevel: 'medium',
    })

    let finalText = ''
    const unsubscribe = session.subscribe((ev) => {
      if (ev.type === 'message_update') {
        const evt = ev.assistantMessageEvent as { type?: string; delta?: string } | undefined
        if (evt?.type === 'text_delta' && evt.delta) {
          finalText += evt.delta
          emit({ type: 'delta', text: evt.delta })
        } else if (evt?.type === 'thinking_delta' && evt.delta) {
          emit({ type: 'thinking', text: evt.delta })
        }
      } else if (ev.type === 'tool_execution_start') {
        emit({ type: 'tool_start', text: `${ev.toolName} ${JSON.stringify(ev.args ?? {}).slice(0, 200)}` })
      } else if (ev.type === 'tool_execution_end') {
        const ok = !ev.isError
        emit({ type: 'tool_end', text: `${ev.toolName} ${ok ? '完成' : '失败'} · ${JSON.stringify(ev.result ?? {}).slice(0, 200)}` })
      }
    })

    try {
      const summary = await session.prompt(task)
      return typeof summary === 'string' && summary ? summary : (finalText || '（子代理未产出文本）')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      emit({ type: 'error', text: msg.slice(0, 300) })
      throw err
    } finally {
      unsubscribe()
    }
  }

  /** 桥接工具名清单（调试/展示用）。 */
  get bridgeToolNames(): string[] {
    return BRIDGE_TOOLS.map((t) => t.name)
  }
}
