/**
 * pi-subagent 内核注册诊断脚本 —— bun src/kernel/diag-pi.ts
 */
import { getKernel, ToolsService, MastraEngineService, PiSubagentService } from './index'

async function main() {
  const ctx = await getKernel()
  for (const p of [ToolsService, MastraEngineService, PiSubagentService].filter(Boolean)) {
    const rt = (ctx.registry as unknown as { get: (p: unknown) => { fiber?: { state?: number; _error?: unknown } } | undefined }).get(p)
    console.log('plugin', (p as { name?: string; provide?: string }).provide ?? p.constructor?.name, '→', JSON.stringify(rt?.fiber?.state), rt?.fiber?._error ? `ERR: ${String(rt.fiber._error).slice(0, 200)}` : '')
  }
  console.log('tools:', typeof (ctx as unknown as Record<string, unknown>).tools)
  console.log('mastra:', typeof (ctx as unknown as Record<string, unknown>).mastra)
  console.log('pi:', typeof (ctx as unknown as Record<string, unknown>).pi)
  await new Promise((r) => setTimeout(r, 300))
  console.log('--- after 300ms ---')
  console.log('tools:', typeof (ctx as unknown as Record<string, unknown>).tools)
  console.log('pi:', typeof (ctx as unknown as Record<string, unknown>).pi)
  const rt2 = (ctx.registry as unknown as { get: (p: unknown) => { fiber?: { state?: number } } | undefined }).get(PiSubagentService)
  console.log('pi fiber state:', JSON.stringify(rt2?.fiber?.state))
}

main().catch((e) => {
  console.error('DIAG ERROR', e)
  process.exitCode = 1
})
