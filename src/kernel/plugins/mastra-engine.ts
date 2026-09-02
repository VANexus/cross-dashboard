/**
 * mastra-engine 插件 —— provide: `mastra` service, inject: ['tools']
 *
 * Mastra 引擎门面（实例嵌入 Next 进程，无独立服务）：workflow 注册表、跨请求
 * suspend/resume 的 Run 注册表。M4 追加 compileWorkflow(spec)：运行时把
 * spec（steps DAG，工具白名单）编译为一次性 mastra workflow 并执行。
 */
import { Context, Service } from '../vendor/cordis'
import { activeRuns, mastra, WORKFLOW_IDS, type WorkflowId } from '@/lib/mastra'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import type { WorkflowSpec, WorkflowSpecStep } from './spec-store'
import type { ToolsService } from './tool-registry'

declare module '../vendor/cordis/context' {
  interface Context {
    mastra: MastraEngineService
  }
}

/** 动态步骤间的统一上下文：各步骤输出按 stepId 累积。 */
const SpecCtx = z.object({
  results: z.record(z.string(), z.unknown()).optional().default({}),
})
type SpecCtxValue = z.infer<typeof SpecCtx>

export interface SpecRunStepResult {
  id: string
  tool: string
  ok: boolean
  summary: string
}

export interface SpecRunResult {
  status: 'success' | 'failed'
  steps: SpecRunStepResult[]
}

/** spec DAG 校验：引用存在、无环、拓扑排序输出。 */
export function topoSortSpecSteps(steps: WorkflowSpecStep[]): WorkflowSpecStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  if (byId.size !== steps.length) throw new Error('spec 存在重复的步骤 id')
  const state = new Map<string, 'visiting' | 'done'>()
  const ordered: WorkflowSpecStep[] = []
  const visit = (s: WorkflowSpecStep) => {
    const st = state.get(s.id)
    if (st === 'done') return
    if (st === 'visiting') throw new Error(`spec 步骤依赖存在环：${s.id}`)
    state.set(s.id, 'visiting')
    for (const dep of s.dependsOn ?? []) {
      const d = byId.get(dep)
      if (!d) throw new Error(`步骤 ${s.id} 依赖了不存在的步骤：${dep}`)
      visit(d)
    }
    state.set(s.id, 'done')
    ordered.push(s)
  }
  for (const s of steps) visit(s)
  return ordered
}

export class MastraEngineService extends Service {
  static provide = 'mastra'
  static inject = ['tools']

  /** Mastra 实例（lib/mastra 模块级单例，与 workflows 共享）。 */
  readonly mastra = mastra

  /** 跨请求 suspend/resume 的 Run 注册表（start 写入 / 终态移除 / suspended 保留）。 */
  readonly activeRuns = activeRuns

  /** 已注册 workflow id 清单。 */
  readonly workflowIds: readonly WorkflowId[] = WORKFLOW_IDS

  private tools: ToolsService

  constructor(ctx: Context) {
    super(ctx, 'mastra')
    this.tools = ctx.tools
  }

  /** id 是否为已注册 workflow（类型收窄）。 */
  hasWorkflow(id: string): id is WorkflowId {
    return (this.workflowIds as readonly string[]).includes(id)
  }

  /**
   * M4 动态工作流：spec（steps DAG）→ 拓扑排序 → 一次性编译 mastra workflow → 执行。
   * 每步调用 tool-registry 白名单工具，输出按 stepId 累积到 results 上下文。
   * onStep 透传每步完成摘要（chat 工具里可忽略或转发）。
   */
  async runSpec(
    spec: WorkflowSpec,
    onStep?: (r: SpecRunStepResult) => void,
  ): Promise<SpecRunResult> {
    const ordered = topoSortSpecSteps(spec.steps)

    // 工具白名单校验（tool-registry 全量）
    for (const s of ordered) {
      if (!this.tools.mastra[s.tool]?.execute) {
        throw new Error(`步骤 ${s.id} 引用了不可执行的工具：${s.tool}`)
      }
    }

    const specId = `spec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const steps = ordered.map((s) =>
      createStep({
        id: s.id,
        description: `动态步骤：调用工具 ${s.tool}`,
        inputSchema: SpecCtx,
        outputSchema: SpecCtx,
        execute: async ({ inputData }) => {
          const ctxValue: SpecCtxValue = SpecCtx.parse(inputData ?? {})
          const run = async (): Promise<SpecCtxValue> => {
            try {
              const out = await this.tools.mastra[s.tool].execute!((s.args ?? {}) as never)
              const summary = JSON.stringify(out ?? null)
              const result: SpecRunStepResult = {
                id: s.id,
                tool: s.tool,
                ok: true,
                summary: summary.length > 400 ? summary.slice(0, 400) + '…' : summary,
              }
              onStep?.(result)
              return { results: { ...ctxValue.results, [s.id]: out } }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              const result: SpecRunStepResult = { id: s.id, tool: s.tool, ok: false, summary: msg.slice(0, 200) }
              onStep?.(result)
              // 单步失败：记录并继续（results 不含该步输出），整体仍可完成
              return { results: { ...ctxValue.results, [s.id]: { __error: msg.slice(0, 200) } } }
            }
          }
          return run()
        },
      }),
    )

    const wf = createWorkflow({
      id: specId,
      description: '动态编译的工作流 spec',
      inputSchema: SpecCtx,
      outputSchema: SpecCtx,
      steps,
    })
    const chained = steps.reduce((acc, s) => acc.then(s), wf).commit()

    const run = await chained.createRun()
    activeRuns.set(run.runId, run)
    let suspended = false
    try {
      const result = await run.start({ inputData: { results: {} } })
      suspended = (result as { status?: string }).status === 'suspended'
      const outputs = ('result' in result ? result.result : {}) as { results?: Record<string, unknown> }
      const stepResults: SpecRunStepResult[] = ordered.map((s) => {
        const out = outputs.results?.[s.id]
        if (out && typeof out === 'object' && '__error' in (out as Record<string, unknown>)) {
          return { id: s.id, tool: s.tool, ok: false, summary: String((out as Record<string, unknown>).__error).slice(0, 200) }
        }
        const summary = JSON.stringify(out ?? null)
        return { id: s.id, tool: s.tool, ok: true, summary: summary.length > 200 ? summary.slice(0, 200) + '…' : summary }
      })
      const failed = stepResults.some((r) => !r.ok)
      return { status: failed ? 'failed' : 'success', steps: stepResults }
    } finally {
      if (!suspended) activeRuns.delete(run.runId)
    }
  }
}
