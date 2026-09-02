/**
 * M0 验证插件：生命周期 / DI / 事件总线 / 可逆副作用
 *
 * - helloPlugin          → provide: `hello` 服务（HelloService）+ timer 副作用
 * - helloConsumerPlugin  → inject: ['hello']，验证声明式依赖注入（内核保证 hello 就绪后才启动）
 * - 副作用：timer + 事件监听 + 共享日志，插件卸载后必须全部消失（可逆）
 */
import { Context, Plugin, Service } from '../vendor/cordis'

// ---- 事件类型扩充（插件间只经事件总线通信）----
declare module '../vendor/cordis/events' {
  interface Events {
    'hello:greet'(name: string): void
  }
}

// ---- Service 类型扩充（ctx.hello 全局可用）----
declare module '../vendor/cordis/context' {
  interface Context {
    hello: HelloService
  }
}

export interface HelloConfig {
  greeting?: string
}

/** 可逆副作用的观察窗（selftest 断言用） */
export const helloSideEffect = {
  timerAlive: false,
  ticks: 0,
  log: [] as string[],
}

export class HelloService extends Service {
  static provide = 'hello'

  private greeting: string

  constructor(ctx: Context, config: HelloConfig) {
    super(ctx, 'hello')
    this.greeting = config.greeting ?? 'hello'
  }

  greet(name: string): string {
    const message = `${this.greeting}, ${name}! (ticks=${helloSideEffect.ticks})`
    this.ctx.emit('hello:greet', name)
    return message
  }
}

/** hello 插件：提供 Service + 可逆副作用 */
export const helloPlugin: Plugin.Function<HelloConfig> = function helloPlugin(
  ctx: Context,
  config: HelloConfig,
) {
  // 提供 Service（卸载时随 fiber 自动回收）
  ctx.plugin(HelloService, config)

  // 副作用 1：timer —— 卸载后必须被清除
  helloSideEffect.timerAlive = true
  const timer = setInterval(() => {
    helloSideEffect.ticks++
  }, 10)
  ctx.effect(
    () => () => {
      clearInterval(timer)
      helloSideEffect.timerAlive = false
    },
    'hello timer',
  )

  // 副作用 2：事件监听 —— 卸载后不再收到广播
  ctx.on('hello:greet', (name) => {
    helloSideEffect.log.push(`listener: ${name}`)
  })
}

/** consumer 插件：声明式 DI —— 内核等 `hello` 服务就绪后才启动本插件 */
export const helloConsumerPlugin: Plugin.Function<Record<string, never>> = Object.assign(
  (ctx: Context) => {
    helloSideEffect.log.push(`consumer ready: ${ctx.hello.greet('consumer')}`)
  },
  { inject: ['hello'] },
)
