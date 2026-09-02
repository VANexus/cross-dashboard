/**
 * spec-store 插件 —— provide: `specs` service
 *
 * AI 动态生成产物的 spec 持久化（Supabase JSONB）：
 * - wf_workflow_specs：动态工作流 spec（M4 plan_workflow 落库 → run_workflow 再次运行）
 * - wf_page_specs：动态页面 spec（M5 generate_page 落库 → /p/[slug] 渲染）
 * schema 全部 zod 定义于此（chat 工具入参 / 落库前校验 / 渲染前校验共用）。
 */
import { z } from 'zod'
import { Context, Service } from '../vendor/cordis'
import { getSupabase } from '@/lib/db'

declare module '../vendor/cordis/context' {
  interface Context {
    specs: SpecStoreService
  }
}

// ── spec schemas（共享契约）────────────────────────────────────────

export const workflowSpecStepSchema = z.object({
  id: z.string().min(1).max(64).describe('步骤 id，如 fetch-trends'),
  tool: z.string().min(1).max(64).describe('工具 id（kernel.tools 白名单）'),
  args: z.record(z.string(), z.unknown()).optional().describe('工具入参'),
  dependsOn: z.array(z.string()).max(12).optional().describe('依赖的前置步骤 id'),
})
export const workflowSpecSchema = z.object({
  steps: z.array(workflowSpecStepSchema).min(1).max(12),
})
export type WorkflowSpecStep = z.infer<typeof workflowSpecStepSchema>
export type WorkflowSpec = z.infer<typeof workflowSpecSchema>

/** M5 动态页面 spec：白名单 component-kit 组件树。 */
export const pageSpecComponentSchema = z.object({
  id: z.string().min(1).max(64),
  component: z.string().min(1).max(64).describe('component-kit 白名单组件 id'),
  props: z.record(z.string(), z.unknown()).optional(),
})
export const pageSpecSchema = z.object({
  components: z.array(pageSpecComponentSchema).min(1).max(30),
})
export type PageSpec = z.infer<typeof pageSpecSchema>

interface WorkflowSpecRow {
  id: string
  title: string
  goal: string
  spec: WorkflowSpec
  updated_at: string
}

export class SpecStoreService extends Service {
  static provide = 'specs'

  constructor(ctx: Context) {
    super(ctx, 'specs')
  }

  // ── workflow specs ─────────────────────────────────────────────

  async saveWorkflowSpec(id: string, title: string, goal: string, spec: WorkflowSpec): Promise<void> {
    const { error } = await getSupabase().from('wf_workflow_specs').upsert({
      id,
      title,
      goal,
      spec,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`工作流 spec 落库失败：${error.message}`)
  }

  async getWorkflowSpec(id: string): Promise<(WorkflowSpecRow & { updated_at: string }) | null> {
    const { data, error } = await getSupabase()
      .from('wf_workflow_specs')
      .select('id, title, goal, spec, updated_at')
      .eq('id', id)
      .maybeSingle<WorkflowSpecRow>()
    if (error) throw new Error(`工作流 spec 读取失败：${error.message}`)
    return data ?? null
  }

  async listWorkflowSpecs(limit = 20): Promise<Array<Pick<WorkflowSpecRow, 'id' | 'title' | 'goal' | 'updated_at'>>> {
    const { data, error } = await getSupabase()
      .from('wf_workflow_specs')
      .select('id, title, goal, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(`工作流 spec 列表失败：${error.message}`)
    return data ?? []
  }

  // ── page specs（M5 渲染用）────────────────────────────────────

  async savePageSpec(id: string, title: string, spec: PageSpec): Promise<void> {
    const { error } = await getSupabase().from('wf_page_specs').upsert({
      id,
      title,
      spec,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`页面 spec 落库失败：${error.message}`)
  }

  async getPageSpec(id: string): Promise<{ id: string; title: string; spec: PageSpec; updated_at: string } | null> {
    const { data, error } = await getSupabase()
      .from('wf_page_specs')
      .select('id, title, spec, updated_at')
      .eq('id', id)
      .maybeSingle<{ id: string; title: string; spec: PageSpec; updated_at: string }>()
    if (error) throw new Error(`页面 spec 读取失败：${error.message}`)
    return data ?? null
  }

  async listPageSpecs(limit = 100): Promise<Array<{ id: string; title: string; updated_at: string }>> {
    const { data, error } = await getSupabase()
      .from('wf_page_specs')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(`页面 spec 列表失败：${error.message}`)
    return data ?? []
  }
}
