/**
 * spec-store 插件 —— provide: `specs` service
 *
 * AI 动态生成产物的 spec 持久化（集群 PG · JSONB）：
 * - wf_workflow_specs：动态工作流 spec（M4 plan_workflow 落库 → run_workflow 再次运行）
 * - wf_page_specs：动态页面 spec（M5 generate_page 落库 → /p/[slug] 渲染）
 * schema 全部 zod 定义于此（chat 工具入参 / 落库前校验 / 渲染前校验共用）。
 */
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { Context, Service } from '../vendor/cordis'
import { prisma, isoRow, isoRows } from '@/lib/server/db'

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
    try {
      const now = new Date().toISOString()
      await prisma.wf_workflow_specs.upsert({
        where: { id },
        create: { id, title, goal, spec: spec as unknown as Prisma.InputJsonValue, updated_at: now },
        update: { title, goal, spec: spec as unknown as Prisma.InputJsonValue, updated_at: now },
      })
    } catch (e) {
      throw new Error(`工作流 spec 落库失败：${(e as Error).message}`)
    }
  }

  async getWorkflowSpec(id: string): Promise<(WorkflowSpecRow & { updated_at: string }) | null> {
    try {
      const row = await prisma.wf_workflow_specs.findUnique({
        where: { id },
        select: { id: true, title: true, goal: true, spec: true, updated_at: true },
      })
      return row ? (isoRow(row) as unknown as WorkflowSpecRow & { updated_at: string }) : null
    } catch (e) {
      throw new Error(`工作流 spec 读取失败：${(e as Error).message}`)
    }
  }

  async listWorkflowSpecs(limit = 20): Promise<Array<Pick<WorkflowSpecRow, 'id' | 'title' | 'goal' | 'updated_at'>>> {
    try {
      const rows = await prisma.wf_workflow_specs.findMany({
        orderBy: { updated_at: 'desc' },
        take: limit,
        select: { id: true, title: true, goal: true, updated_at: true },
      })
      return isoRows(rows) as unknown as Array<Pick<WorkflowSpecRow, 'id' | 'title' | 'goal' | 'updated_at'>>
    } catch (e) {
      throw new Error(`工作流 spec 列表失败：${(e as Error).message}`)
    }
  }

  // ── page specs（M5 渲染用）────────────────────────────────────

  async savePageSpec(id: string, title: string, spec: PageSpec): Promise<void> {
    try {
      const now = new Date().toISOString()
      await prisma.wf_page_specs.upsert({
        where: { id },
        create: { id, title, spec: spec as unknown as Prisma.InputJsonValue, updated_at: now },
        update: { title, spec: spec as unknown as Prisma.InputJsonValue, updated_at: now },
      })
    } catch (e) {
      throw new Error(`页面 spec 落库失败：${(e as Error).message}`)
    }
  }

  async getPageSpec(id: string): Promise<{ id: string; title: string; spec: PageSpec; updated_at: string } | null> {
    try {
      const row = await prisma.wf_page_specs.findUnique({
        where: { id },
        select: { id: true, title: true, spec: true, updated_at: true },
      })
      return row
        ? (isoRow(row) as unknown as { id: string; title: string; spec: PageSpec; updated_at: string })
        : null
    } catch (e) {
      throw new Error(`页面 spec 读取失败：${(e as Error).message}`)
    }
  }

  async listPageSpecs(limit = 100): Promise<Array<{ id: string; title: string; updated_at: string }>> {
    try {
      const rows = await prisma.wf_page_specs.findMany({
        orderBy: { updated_at: 'desc' },
        take: limit,
        select: { id: true, title: true, updated_at: true },
      })
      return isoRows(rows) as unknown as Array<{ id: string; title: string; updated_at: string }>
    } catch (e) {
      throw new Error(`页面 spec 列表失败：${(e as Error).message}`)
    }
  }

  /**
   * M5 增量：对已发布动态页面的组件树做 append / replace / remove，
   * 读 → 校验 → 写回（/p/[slug] RSC 渲染即时反映新组件）。
   */
  async updatePageSpec(
    id: string,
    patch: {
      op: 'append' | 'insert' | 'replace' | 'remove' | 'move'
      component?: PageSpec['components'][number]
      index?: number
      /** move 目标位置（0 起） */
      to?: number
    },
  ): Promise<{ ok: boolean; id: string; componentCount: number; operation: string }> {
    const row = await this.getPageSpec(id)
    if (!row) throw new Error(`页面 ${id} 不存在，请先用 generate_page 创建`)
    const components = [...((row.spec?.components as PageSpec['components']) ?? [])]

    if (patch.op === 'append') {
      if (!patch.component) throw new Error('append 需要提供 component（新增组件实例）')
      components.push(patch.component)
    } else if (patch.op === 'insert') {
      if (!patch.component || typeof patch.index !== 'number') throw new Error('insert 需要 component 与 index')
      if (patch.index < 0 || patch.index > components.length) throw new Error(`insert 位置 ${patch.index} 越界（共 ${components.length} 个）`)
      components.splice(patch.index, 0, patch.component)
    } else if (patch.op === 'replace') {
      if (!patch.component || typeof patch.index !== 'number') throw new Error('replace 需要 index 与 component')
      if (patch.index < 0 || patch.index >= components.length) throw new Error(`index ${patch.index} 越界（共 ${components.length} 个）`)
      components[patch.index] = patch.component
    } else if (patch.op === 'remove') {
      if (typeof patch.index !== 'number') throw new Error('remove 需要 index')
      if (patch.index < 0 || patch.index >= components.length) throw new Error(`index ${patch.index} 越界（共 ${components.length} 个）`)
      components.splice(patch.index, 1)
    } else if (patch.op === 'move') {
      if (typeof patch.index !== 'number' || typeof patch.to !== 'number') throw new Error('move 需要 index 与 to')
      if (patch.index < 0 || patch.index >= components.length || patch.to < 0 || patch.to >= components.length) {
        throw new Error(`move 越界（index=${patch.index} to=${patch.to}，共 ${components.length} 个）`)
      }
      const [item] = components.splice(patch.index, 1)
      components.splice(patch.to, 0, item)
    } else {
      throw new Error(`未知操作：${String(patch.op)}`)
    }
    if (components.length === 0) throw new Error('页面至少保留一个组件；清空请用 generate_page 重建')

    const spec: PageSpec = { components }
    pageSpecSchema.parse(spec) // 形状门
    await this.savePageSpec(id, row.title, spec)
    return { ok: true, id, componentCount: components.length, operation: patch.op }
  }
}
