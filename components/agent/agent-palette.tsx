// components/agent/agent-palette.tsx
'use client';
// L1 ⌘K 计划面板:不是聊天窗,而是 RAK 执行计划的可视面。
// 输入指令 → 执行 → 消费 /api/agent/plan 的 plan_step SSE,步骤逐个点亮。
// GSAP 进出场;Esc/遮罩关闭;执行期间按钮进入 loading 态。
// 样式 token: --palette-* (app/globals.css,固定深色,不随主题切换)
import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { usePresence } from '@/stores/agent-presence';

interface Step {
  id: string;
  title: string;
  tool: string;
  status: 'pending' | 'run' | 'done';
}

const INITIAL_STEPS: Step[] = [
  { id: 'crawl', title: '抓取类目竞品快照', tool: 'crawler.getStatus', status: 'pending' },
  { id: 'trend', title: '拉取运营指标与趋势', tool: 'dashboard.getStats', status: 'pending' },
  { id: 'risk', title: '扫描风险与隔离项', tool: 'risk.getHealth', status: 'pending' },
  { id: 'output', title: '汇总结果写回看板', tool: 'output.report', status: 'pending' },
];

// ── Workflow 快捷入口(/api/agent/run)──────────────────────────

const WORKFLOW_STEPS: Record<string, { id: string; title: string }[]> = {
  'b2b-daily-trends': [
    { id: 'tiktok-trends', title: '拉取 TikTok 热词趋势' },
    { id: 'ig-trends', title: '拉取 IG 话题趋势' },
    { id: 'alibaba-hotwords', title: '汇总阿里在售热词' },
    { id: 'summarize', title: '生成今日榜单摘要' },
  ],
  'listing-pipeline': [
    { id: 'listing-generate', title: '生成 Listing 草稿' },
    { id: 'human-confirm', title: '人工确认 Listing' },
    { id: 'imaging-generate', title: '生成产品主图' },
  ],
};

const WORKFLOW_BUTTONS: { id: string; label: string }[] = [
  { id: 'b2b-daily-trends', label: '每日趋势榜单' },
  { id: 'listing-pipeline', label: 'Listing 流水线' },
];

/** 解析 SSE 文本帧:event: <name>\ndata: <json> */
async function* sseFrames(res: Response): AsyncGenerator<{ event: string; data: string }> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const evLine = frame.split('\n').find((l) => l.startsWith('event: '));
      const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
      if (evLine && dataLine) {
        yield { event: evLine.slice(7), data: dataLine.slice(6) };
      }
    }
  }
}

export function AgentPalette() {
  const ref = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const open = usePresence((s) => s.paletteOpen);
  const setOpen = usePresence((s) => s.setPaletteOpen);
  const pushTelemetry = usePresence((s) => s.pushTelemetry);
  const setLiveState = usePresence((s) => s.setLiveState);
  const setDrawerOpen = usePresence((s) => s.setDrawerOpen);
  const context = usePresence((s) => s.context);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [question, setQuestion] = useState('分析收纳类目近 7 天趋势,找出 3 个选品机会');
  // workflow 快捷执行状态
  const [wfSteps, setWfSteps] = useState<Step[] | null>(null);
  const [runningWf, setRunningWf] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    wfId: string; runId: string; stepId: string; message: string;
  } | null>(null);

  // ⌘K / Ctrl+K 全局开合
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // GSAP 进出场
  useEffect(() => {
    const el = ref.current;
    const veil = veilRef.current;
    if (!el || !veil) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set([el, veil], { autoAlpha: open ? 1 : 0 });
      return;
    }
    if (open) {
      gsap.set([el, veil], { display: 'block' });
      gsap.fromTo(veil, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 });
      gsap.fromTo(el, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.22, ease: 'power3.out' });
    } else {
      gsap.to(veil, { autoAlpha: 0, duration: 0.15 });
      gsap.to(el, { autoAlpha: 0, scale: 0.98, duration: 0.18, ease: 'power2.in' });
    }
  }, [open]);

  const execute = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setSteps(INITIAL_STEPS);
    setLiveState('busy', 0.72);
    pushTelemetry('选品 Agent', '开始执行计划 · ' + (question || '默认计划'));
    try {
      const res = await fetch('/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      for await (const frame of sseFrames(res)) {
        if (frame.event === 'plan_step') {
          const ev = JSON.parse(frame.data) as { id: string; status: string; tool?: string };
          setSteps((prev) =>
            prev.map((s) =>
              s.id === ev.id
                ? { ...s, status: ev.status as Step['status'], tool: ev.tool ?? s.tool }
                : s,
            ),
          );
          if (ev.status === 'done') pushTelemetry('选品 Agent', ev.tool ?? ev.id + ' 完成');
        } else if (frame.event === 'state') {
          const ev = JSON.parse(frame.data) as { state: 'idle' | 'busy' | 'consensus'; activity: number };
          setLiveState(ev.state, ev.activity);
        }
      }
      pushTelemetry('选品 Agent', '计划执行完毕 ✓');
    } catch {
      pushTelemetry('选品 Agent', '计划执行中断 · 网络或服务异常');
    } finally {
      setLiveState('idle', 0.12);
      setRunning(false);
    }
  }, [running, question, context, pushTelemetry, setLiveState]);

  // ── Workflow 快捷执行:消费 /api/agent/run 的 SSE ───────────────

  const consumeRunStream = useCallback(async (res: Response, wfId: string) => {
    for await (const frame of sseFrames(res)) {
      if (frame.event === 'plan_step') {
        const ev = JSON.parse(frame.data) as {
          id: string; status: 'run' | 'done' | 'confirm';
          tool?: string; runId?: string; message?: string;
        };
        setWfSteps((prev) =>
          (prev ?? []).map((s) =>
            s.id === ev.id
              ? { ...s, status: ev.status === 'confirm' ? 'run' : ev.status, tool: ev.tool ?? s.tool }
              : s,
          ),
        );
        if (ev.status === 'done') pushTelemetry('工作流', ev.tool ?? ev.id + ' 完成');
        if (ev.status === 'confirm') {
          // suspend 到达:打开抽屉注入确认提示,面板内也渲染确认条
          setPendingConfirm({
            wfId, runId: ev.runId ?? '', stepId: ev.id,
            message: ev.message ?? '等待人工确认',
          });
          pushTelemetry('Listing Agent', ev.message ?? '等待人工确认');
          setDrawerOpen(true);
        }
      } else if (frame.event === 'state') {
        const ev = JSON.parse(frame.data) as { state: 'idle' | 'busy' | 'consensus'; activity: number };
        setLiveState(ev.state, ev.activity);
      }
      // card 事件由 presence 通道(/api/agent/stream)供抽屉渲染,palette 不重复处理
    }
  }, [pushTelemetry, setLiveState, setDrawerOpen]);

  const runWorkflow = useCallback(async (wfId: string) => {
    if (runningWf || running) return;
    const label = WORKFLOW_BUTTONS.find((w) => w.id === wfId)?.label ?? wfId;
    setRunningWf(wfId);
    setWfSteps(WORKFLOW_STEPS[wfId].map((s) => ({ ...s, tool: '', status: 'pending' as const })));
    setPendingConfirm(null);
    setLiveState('busy', 0.72);
    pushTelemetry('工作流', `启动 ${label}`);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: wfId, input: {} }),
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      await consumeRunStream(res, wfId);
    } catch {
      pushTelemetry('工作流', `${label} 中断 · 网络或服务异常`);
    } finally {
      setLiveState('idle', 0.12);
      setRunningWf(null);
    }
  }, [runningWf, running, consumeRunStream, pushTelemetry, setLiveState]);

  const confirmResume = useCallback(async (confirmed: boolean) => {
    if (!pendingConfirm) return;
    const { wfId, runId, stepId } = pendingConfirm;
    setPendingConfirm(null);
    setRunningWf(wfId);
    setLiveState('busy', 0.72);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: wfId, resume: { runId, stepId, confirmed } }),
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      await consumeRunStream(res, wfId);
    } catch {
      pushTelemetry('工作流', confirmed ? '确认请求失败 · 请重试' : '流程已按计划终止');
    } finally {
      setLiveState('idle', 0.12);
      setRunningWf(null);
    }
  }, [pendingConfirm, consumeRunStream, pushTelemetry, setLiveState]);

  return (
    <>
      <div
        ref={veilRef}
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'none',
          background: 'var(--palette-veil)' }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Agent 指令面板"
        style={{ position: 'fixed', zIndex: 31, left: '50%', top: '12vh', transform: 'translateX(-50%)',
          width: 'min(620px, calc(100vw - 32px))', visibility: 'hidden', opacity: 0,
          background: 'var(--palette-bg)',
          border: '1px solid var(--palette-ai-soft)', borderRadius: 16,
          boxShadow: 'var(--shadow-overlay)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
          <span style={{ color: 'var(--palette-ai)', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>✦</span>
          <input
            aria-label="向 Agent 下达指令"
            placeholder="向 Agent 下达指令,它将生成执行计划…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') execute(); }}
            style={{ flex: 1, background: 'none', border: 0, outline: 0, color: 'var(--palette-fg)',
              font: 'inherit', fontSize: 14.5, caretColor: 'var(--palette-ai)' }}
          />
        </div>

        {/* Workflow 快捷入口 */}
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px' }}>
          {WORKFLOW_BUTTONS.map((w) => (
            <button
              key={w.id}
              onClick={() => runWorkflow(w.id)}
              disabled={runningWf !== null || running}
              style={{ background: runningWf === w.id ? 'var(--palette-wf-soft)' : 'transparent',
                border: `1px solid ${runningWf === w.id ? 'var(--palette-ai)' : 'var(--palette-ai-faint)'}`,
                color: runningWf === w.id ? 'var(--palette-ai)' : 'var(--palette-fg)',
                borderRadius: 8, font: 'inherit', fontSize: 12, padding: '6px 12px',
                cursor: runningWf !== null || running ? 'default' : 'pointer',
                opacity: runningWf !== null && runningWf !== w.id ? 0.45 : 1 }}
            >{runningWf === w.id ? '执行中…' : `✦ ${w.label}`}</button>
          ))}
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--palette-border)', maxHeight: 280, overflow: 'auto' }}>
          {(wfSteps ?? steps).map((s) => (
            <li key={s.id} style={{ display: 'flex', gap: 11, padding: '9px 16px', alignItems: 'flex-start' }}>
              <span aria-hidden style={{ flex: 'none', width: 18, height: 18, borderRadius: '50%', marginTop: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontFamily: 'ui-monospace, monospace', fontWeight: 700,
                border: `1.5px solid ${s.status === 'pending' ? 'var(--palette-muted)' : s.status === 'run' ? 'var(--palette-ai)' : 'var(--palette-ok)'}`,
                background: s.status === 'done' ? 'var(--palette-ok)' : 'transparent',
                color: 'var(--palette-ok-ink)' }}>
                {s.status === 'done' ? '✓' : ''}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: s.status === 'run' ? 'var(--palette-ai)' : 'var(--palette-fg)' }}>{s.title}</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5,
                  color: s.status === 'run' ? 'var(--palette-ai)' : 'var(--palette-muted)' }}>{s.tool}</div>
              </div>
              {s.status === 'run' && (
                <span role="status" aria-label="执行中" style={{ marginLeft: 'auto', flex: 'none', width: 8, height: 8,
                  borderRadius: '50%', background: 'var(--palette-ai)' }} />
              )}
            </li>
          ))}
        </ul>

        {/* suspend 确认条:确认继续 → resume;终止 → 结束流程 */}
        {pendingConfirm && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--palette-border)',
            background: 'var(--palette-wf-faint)' }}>
            <div style={{ fontSize: 12, color: 'var(--palette-fg)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--palette-wf)', fontFamily: 'ui-monospace, monospace' }}>⏸ </span>
              {pendingConfirm.message}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => confirmResume(true)}
                style={{ background: 'var(--palette-wf)', color: 'var(--palette-wf-ink)', border: 0,
                  borderRadius: 8, font: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 14px', cursor: 'pointer' }}
              >确认继续</button>
              <button
                onClick={() => confirmResume(false)}
                style={{ background: 'transparent', border: '1px solid var(--palette-border)', color: 'var(--palette-muted)',
                  borderRadius: 8, font: 'inherit', fontSize: 12, padding: '5px 14px', cursor: 'pointer' }}
              >终止</button>
            </div>
          </div>
        )}

        <footer style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderTop: '1px solid var(--palette-border)', background: 'var(--palette-footer)' }}>
          <span style={{ fontSize: 11, color: 'var(--palette-muted)', fontFamily: 'ui-monospace, monospace' }}>ESC 关闭 · 步骤由服务端 SSE 推送</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'transparent', border: '1px solid var(--palette-border)', color: 'var(--palette-muted)',
              borderRadius: 8, font: 'inherit', fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}
          >关闭</button>
          <button
            onClick={execute}
            disabled={running}
            style={{ background: 'var(--palette-wf)', color: 'var(--palette-wf-ink)', border: 0, borderRadius: 8,
              font: 'inherit', fontSize: 12, fontWeight: 700, padding: '6px 14px',
              cursor: running ? 'default' : 'pointer', opacity: running ? 0.55 : 1 }}
          >{running ? '执行中…' : '执行计划'}</button>
        </footer>
      </div>
    </>
  );
}
