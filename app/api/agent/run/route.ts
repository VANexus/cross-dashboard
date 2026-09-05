// app/api/agent/run/route.ts
// Mastra workflow 执行端点:POST { workflowId, input?, resume? } → SSE。
//
// 事件流(沿用 lib/agent/contracts.ts 契约):
//   state busy/idle               — 运行状态(驱动智体球)
//   plan_step { run|done|confirm } — 步骤推进;confirm = suspend 等待人工确认
//   telemetry                     — 步骤结果摘要
//   card { cardType, data }       — 关键步骤的结构化卡片(趋势榜/Listing/图片)
//
// start:mastra.getWorkflow(id).createRun() → run.watch(事件→SSE+event-bus) → run.start()。
// resume:activeRuns 取回 Run 实例 → run.resume({ resumeData: { confirmed }, step })。
// 所有事件同时 publish 到 event-bus(WORKFLOW_TOPIC),由 /api/agent/stream 广播给 presence 订阅者。
// 客户端 abort:仅停止本连接入队,workflow 继续执行(event-bus 广播与 resume 能力不受影响)。
import { NextRequest } from 'next/server';
import type { WorkflowStreamEvent } from '@mastra/core/workflows';
import { getKernel } from '@/src/kernel';
import type { WorkflowId } from '@/lib/server/mastra';
import { publish, WORKFLOW_TOPIC } from '@/lib/server/mastra/event-bus';
import {
  saveRunSnapshot,
  getRunSnapshot,
  deleteRunSnapshot,
} from '@/lib/server/mastra/run-registry';
import { resumeListingPipeline, type ListingContinuationContext } from '@/lib/server/mastra/workflows/listing-pipeline';
import { encodeEvent, type AgentEvent } from '@/lib/agent/contracts';

// 长流程(趋势 MCP 拉取/生图)放宽执行时限
export const maxDuration = 300;

// ── 步骤 → 卡片/摘要 映射 ────────────────────────────────────────

const CARD_STEPS: Record<string, string> = {
  'tiktok-trends': 'trends',
  'ig-trends': 'trends',
  'alibaba-hotwords': 'trends',
  summarize: 'trends-summary',
  'listing-generate': 'listing',
  'imaging-generate': 'images',
};

// D2：可跨实例恢复的 workflow → suspend 之后的续执行（复用同批工具函数）。
type Continuation = (
  ctx: Record<string, unknown>,
  confirmed: boolean,
) => Promise<{ status: 'ok' | 'cancelled'; output?: unknown }>;

const CONTINUATIONS: Record<string, Continuation> = {
  'listing-pipeline': async (ctx, confirmed) => {
    const r = await resumeListingPipeline(ctx as ListingContinuationContext, confirmed);
    return r.status === 'ok' ? { status: 'ok', output: r.output } : { status: 'cancelled' };
  },
};

type LooseRecord = Record<string, unknown>;

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asRecord(v: unknown): LooseRecord | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as LooseRecord) : undefined;
}

/** 步骤完成的结果摘要(plan_step.done.tool 文案)。 */
function describeStep(stepId: string, output: LooseRecord | undefined): string {
  const tiktok = asRecord(output?.tiktok);
  const instagram = asRecord(output?.instagram);
  const listing = asRecord(output?.listing);
  switch (stepId) {
    case 'tiktok-trends':
      return `TikTok 趋势 · ${asArray(tiktok?.keywords).length} 词`;
    case 'ig-trends':
      return `IG 话题 · ${asArray(instagram?.keywords).length} 条`;
    case 'alibaba-hotwords':
      return `阿里热词 · ${asArray(output?.hotwords).length} 个`;
    case 'summarize':
      return `榜单已生成 · Top${asArray(output?.topPicks).length}`;
    case 'listing-generate':
      return `Listing 草稿 · ${String(listing?.title ?? '').slice(0, 24)}`;
    case 'human-confirm':
      return '已确认 · 继续生图';
    case 'imaging-generate':
      return `产品图 · ${asArray(output?.images).length} 张`;
    default:
      return `${stepId} 完成`;
  }
}

/** 关键步骤 → card 事件的数据载荷。 */
function cardDataFor(stepId: string, output: LooseRecord | undefined): LooseRecord | undefined {
  switch (stepId) {
    case 'tiktok-trends':
      return asRecord(output?.tiktok);
    case 'ig-trends':
      return asRecord(output?.instagram);
    case 'alibaba-hotwords':
      return { hotwords: output?.hotwords, authorized: output?.authorized, degraded: output?.hotwordsDegraded };
    case 'summarize':
    case 'listing-generate':
    case 'imaging-generate':
      return output;
    default:
      return undefined;
  }
}

export async function POST(req: NextRequest) {
  let body: {
    workflowId?: string;
    input?: LooseRecord;
    resume?: { runId?: string; stepId?: string; confirmed?: boolean };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  // M1 插件化：Mastra 引擎从后端内核取（mastra service）
  const engine = (await getKernel()).mastra;

  const workflowId = body.workflowId as WorkflowId | undefined;
  if (!workflowId || !engine.workflowIds.includes(workflowId)) {
    return Response.json({ error: `未知 workflowId,可选:${engine.workflowIds.join(' / ')}` }, { status: 400 });
  }
  const resume = body.resume;
  if (resume && (!resume.runId || typeof resume.confirmed !== 'boolean')) {
    return Response.json({ error: 'resume 需要 { runId, stepId, confirmed }' }, { status: 400 });
  }
  // D2：不再要求 resume 的 runId 必须在本进程 activeRuns —— 找不到时走
  // Redis 快照冷恢复（见 coldResume），跨 pod/重启后仍可恢复挂起运行。

  const encoder = new TextEncoder();
  const input = (body.input ?? {}) as LooseRecord;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsub: (() => void) | undefined;
      let currentRunId: string | undefined;

      const enqueue = (ev: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(ev)));
        } catch {
          closed = true;
        }
      };
      // 双通道:回应当前请求 + 广播给 presence 订阅者
      const emit = (ev: AgentEvent) => {
        enqueue(ev);
        try {
          publish(WORKFLOW_TOPIC, ev);
        } catch {
          // 广播失败不影响本次 SSE
        }
      };

      // 客户端断开:停止入队,保留 watch(event-bus 继续广播)
      const onAbort = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      // 流程结束:退订 watch + 收尾
      const finish = () => {
        req.signal.removeEventListener('abort', onAbort);
        unsub?.();
        unsub = undefined;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', onAbort);

      void (async () => {
        try {
          emit({ type: 'state', state: 'busy', activity: 0.72 });

          let sawSuspend = false;
          // suspend 前的业务上下文（逐步累积，供跨实例快照）
          let keptContext: LooseRecord | undefined;

          const onEvent = (event: WorkflowStreamEvent) => {
            try {
              switch (event.type) {
                case 'workflow-start':
                  emit({ type: 'state', state: 'busy', activity: 0.72 });
                  break;
                case 'workflow-step-start':
                  emit({ type: 'plan_step', id: event.payload.id, status: 'run' });
                  break;
                case 'workflow-step-result': {
                  const { id, status, output } = event.payload;
                  if (status === 'suspended') break; // 由 workflow-step-suspended 处理
                  const out = asRecord(output);
                  if (status === 'success') {
                    // D2：累积产物上下文（listing-pipeline 每步输出都展开完整 ctx）
                    keptContext = out ?? keptContext;
                    const tool = describeStep(id, out);
                    emit({ type: 'plan_step', id, status: 'done', tool });
                    emit({ type: 'telemetry', agent: '工作流', text: tool });
                    const cardType = CARD_STEPS[id];
                    if (cardType) {
                      const data = cardDataFor(id, out);
                      if (data) emit({ type: 'card', cardType, data });
                    }
                  } else if (status === 'failed') {
                    emit({ type: 'plan_step', id, status: 'done', tool: `⚠️ ${id} 失败` });
                    emit({ type: 'telemetry', agent: '工作流', text: `步骤 ${id} 执行失败` });
                  }
                  break;
                }
                case 'workflow-step-suspended': {
                  sawSuspend = true;
                  const { id, suspendPayload } = event.payload;
                  const sp = asRecord(suspendPayload);
                  // D2：把挂起点业务上下文落 Redis 快照（跨 pod/重启后仍可恢复）
                  if (currentRunId) {
                    void saveRunSnapshot({
                      workflowId,
                      runId: currentRunId,
                      stepId: id,
                      context: keptContext ?? (input as LooseRecord),
                      suspendPayload: sp,
                      updatedAt: Date.now(),
                    });
                  }
                  emit({
                    type: 'plan_step',
                    id,
                    status: 'confirm',
                    runId: currentRunId,
                    message: `「${String(sp?.title ?? '待确认项')}」已生成,等待确认 — ${String(sp?.summary ?? '')}`,
                  });
                  emit({ type: 'telemetry', agent: '工作流', text: '已挂起 · 等待人工确认' });
                  break;
                }
                case 'workflow-finish': {
                  const st = event.payload.workflowStatus;
                  if (currentRunId) void deleteRunSnapshot(currentRunId);
                  if (st === 'success') {
                    emit({ type: 'telemetry', agent: '工作流', text: '工作流执行完成 ✓' });
                  } else if (st === 'failed') {
                    emit({ type: 'telemetry', agent: '工作流', text: '工作流执行失败 · 可重试' });
                  }
                  break;
                }
                default:
                  break;
              }
            } catch {
              // 单个事件映射失败不中断流
            }
          };

          // D2 冷恢复：本进程没有该 Run（跨 pod/重启）→ 用 Redis 快照续跑 suspend 之后的链路
          const coldResume = async (runId: string): Promise<boolean> => {
            const snap = await getRunSnapshot(runId);
            if (!snap) {
              emit({ type: 'telemetry', agent: '工作流', text: '运行不存在或已结束（快照已过期）——请重新发起' });
              return false;
            }
            currentRunId = snap.runId;
            const cont = CONTINUATIONS[snap.workflowId];
            if (!cont) {
              emit({ type: 'telemetry', agent: '工作流', text: `${snap.workflowId} 不支持跨实例恢复——请重新发起` });
              return false;
            }
            emit({
              type: 'plan_step',
              id: snap.stepId,
              status: 'confirm',
              runId: snap.runId,
              message: '跨实例恢复：已取回挂起快照，继续执行',
            });
            try {
              const r = await cont(snap.context ?? {}, resume!.confirmed as boolean);
              if (r.status === 'ok' && r.output) {
                const out = r.output as LooseRecord;
                const images = asArray(out?.images);
                emit({ type: 'plan_step', id: snap.stepId, status: 'done', tool: `已确认 · 产品图 ${images.length} 张` });
                emit({ type: 'telemetry', agent: '工作流', text: `跨实例恢复完成 · 产品图 ${images.length} 张` });
                if (images.length > 0) emit({ type: 'card', cardType: 'images', data: { images } });
              } else {
                emit({ type: 'telemetry', agent: '工作流', text: '用户终止了 Listing 流水线' });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              emit({ type: 'telemetry', agent: '系统', text: `跨实例恢复异常 · ${msg.slice(0, 80)}` });
            } finally {
              await deleteRunSnapshot(snap.runId);
            }
            return true;
          };

          let resultStatus = '';
          if (resume?.runId) {
            const run = engine.activeRuns.get(resume.runId);
            if (run) {
              // 热路径：本进程持有 Run，mastra 原生 resume（事件走 watch）
              currentRunId = run.runId;
              unsub = run.watch(onEvent);
              const result = await run.resume({
                resumeData: { confirmed: resume.confirmed as boolean },
                step: resume.stepId,
              });
              resultStatus = result.status;
            } else {
              // 冷路径：跨 pod/进程重启 → 快照 continuation（不入 watch）
              const done = await coldResume(resume.runId);
              if (!done) return; // 不可恢复，流内已提示，走 finally 收尾
            }
          } else {
            const run = await engine.mastra.getWorkflow(workflowId).createRun();
            engine.activeRuns.set(run.runId, run);
            currentRunId = run.runId;
            unsub = run.watch(onEvent);
            const result = await run.start({ inputData: input });
            resultStatus = result.status;
          }

          // watch 挂起事件缺失时的兜底(不同引擎事件顺序差异)
          if (resultStatus === 'suspended' && !sawSuspend) {
            emit({
              type: 'plan_step',
              id: resume?.stepId ?? 'human-confirm',
              status: 'confirm',
              runId: currentRunId,
              message: '已挂起,等待人工确认',
            });
          }
          if (resultStatus !== 'suspended' && currentRunId) {
            engine.activeRuns.delete(currentRunId);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          emit({ type: 'telemetry', agent: '系统', text: `工作流执行异常 · ${msg.slice(0, 80)}` });
          // 用户终止/执行出错：一并清理挂起快照（避免 30min TTL 内误恢复）
          if (currentRunId) void deleteRunSnapshot(currentRunId);
        } finally {
          if (!closed) {
            emit({ type: 'state', state: 'idle', activity: 0.12 });
          }
          finish();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
