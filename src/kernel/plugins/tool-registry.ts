/**
 * tool-registry 插件 —— provide: `tools` service
 *
 * 全部业务工具的统一注册表：本地工具（lib/mastra/tools/local-tools，WorkflowService 直连）
 * + MCP 重技能工具（lib/mastra/tools/mcp-tools，flowmind 技能）。后续 pi 子代理桥接、
 * supabase / dailyhot 工具也在此合并。
 * - `mastra`    ：@mastra/core 原生工具（workflow / mastra agent 挂载用）
 * - `toAiSdkTools()`：转换为 AI SDK ToolSet（chat 路由流式调用用）
 */
import { tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod'
import { Context, Service } from '../vendor/cordis'
import { localTools } from '@/lib/mastra/tools/local-tools'
import { mcpTools } from '@/lib/mastra/tools/mcp-tools'

declare module '../vendor/cordis/context' {
  interface Context {
    tools: ToolsService
  }
}

/** mastra createTool 产物的结构视图（仅取转换所需字段，刻意类型擦除）。 */
export interface MastraToolLike {
  id: string;
  description?: string;
  inputSchema?: z.ZodType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mastra 工具 execute 泛型各异，转换层统一擦除
  execute?: (input: any, context?: any) => Promise<any>;
}

export class ToolsService extends Service {
  static provide = 'tools'

  /** 工具名 → mastra 原生工具。 */
  readonly mastra: Record<string, MastraToolLike>

  constructor(ctx: Context) {
    super(ctx, 'tools')
    this.mastra = { ...localTools, ...mcpTools } as unknown as Record<string, MastraToolLike>
  }

  /** 全部工具的 AI SDK ToolSet 视图（chat 流式调用用；无 execute 的工具跳过）。 */
  toAiSdkTools(): ToolSet {
    const out: ToolSet = {}
    for (const [name, mt] of Object.entries(this.mastra)) {
      if (!mt.execute) continue
      const execute = mt.execute
      out[name] = tool({
        description: mt.description ?? name,
        inputSchema: mt.inputSchema ?? z.object({}),
        execute: async (input) => execute(input),
      })
    }
    return out
  }
}
