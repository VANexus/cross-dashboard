/**
 * M0 内核自验证脚本 —— 运行：bun src/kernel/selftest.ts
 *
 * 验证四件事：
 *   1. 生命周期：插件加载 → Service 全局可用
 *   2. 声明式 DI：consumer 声明 inject: ['hello']，内核等 hello 就绪后才启动
 *   3. 事件总线：跨插件广播/接收
 *   4. 可逆副作用：热卸载后 timer 清除、监听移除、Service 消失
 */
import { createKernel } from './index'
import { helloPlugin, helloConsumerPlugin, helloSideEffect } from './plugins/hello'

let failed = false
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    failed = true
    process.exitCode = 1
    throw new Error(`assertion failed: ${msg}`)
  }
  console.log(`  ✓ ${msg}`)
}

async function main() {
  console.log('[M0 kernel selftest]')
  const root = createKernel()
  const getHello = () => (root as unknown as { hello?: { greet(n: string): string } }).hello

  // 1. 生命周期
  await root.plugin(helloPlugin, { greeting: '你好' })
  assert(typeof getHello()?.greet === 'function', '生命周期：hello 插件加载，Service 全局可用')

  // 2. 声明式 DI
  await root.plugin(helloConsumerPlugin, {})
  assert(
    helloSideEffect.log.some((l) => l.startsWith('consumer ready:')),
    'DI：consumer 声明 inject:["hello"]，内核等就绪后注入',
  )

  // 3. 事件总线
  root.emit('hello:greet', 'kernel')
  assert(helloSideEffect.log.includes('listener: kernel'), '事件总线：hello:greet 跨插件广播')

  // 4. 可逆副作用（卸载前）
  assert(helloSideEffect.timerAlive, '副作用：timer 运行中')

  // 5. 热卸载 → 副作用全部撤销
  root.registry.delete(helloPlugin)
  await new Promise((r) => setTimeout(r, 50))
  assert(getHello() === undefined, '卸载：hello Service 已从内核回收')
  assert(!helloSideEffect.timerAlive, '卸载：timer 已清除（disposer 自动执行）')

  const before = helloSideEffect.log.length
  root.emit('hello:greet', 'after-unload')
  assert(
    helloSideEffect.log.length === before,
    '卸载：事件监听已移除，广播不再被接收',
  )

  console.log(failed ? '[FAIL]' : '[M0 selftest PASS]')
}

main().catch((err) => {
  console.error('[M0 selftest ERROR]', err)
  process.exitCode = 1
})
