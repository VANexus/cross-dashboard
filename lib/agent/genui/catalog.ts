// lib/agent/genui/catalog.ts
// 共享层（isomorphic，仅依赖 zod）：FlowMind 的 json-render catalog。
//
// 用 Vercel json-render 的组件树（spec：root+elements 扁平映射）+ 内置 actions，
// 让 AI 在对话流里内联输出 JSONL patches 编译成 UI spec，客户端 <Renderer> 渲染。
// catalog.prompt({mode:'inline'}) 自动生成系统提示词（替代手写 COMPONENT_SHAPES）。
//
// 组件 props 用 z.object（json-render 要求 object + 字段常走 .nullable()）。
// 组件 key 用白名单 id（stat-card 等连字符）；若枚举校验不认连字符再改驼峰别名。
import { z } from 'zod';
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';

// ── 组件 props schema（与 components/agent/generated 同形状，供服务端 prompt + 客户端渲染） ──

const statCardProps = z.object({
  title: z.string().describe('指标名'),
  value: z.union([z.string(), z.number()]).describe('指标值'),
  delta: z.string().nullable().describe('变化幅度，如 +12.4% / -3.1%'),
  hint: z.string().nullable().describe('补充说明（一行）'),
});

const chartPoint = z.object({ label: z.string(), value: z.number() });

const dataTableProps = z.object({
  title: z.string().nullable(),
  columns: z.array(z.string()).describe('表头'),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe('数据行'),
});

const rankingProps = z.object({
  title: z.string().nullable(),
  unit: z.string().nullable().describe('数值单位'),
  items: z.array(
    z.object({
      rank: z.number().nullable().describe('名次（默认按数组顺序）'),
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      delta: z.string().nullable().describe('趋势，如 +12.4%'),
    }),
  ),
});

const compareProps = z.object({
  title: z.string().nullable(),
  left: z.string().describe('左列名'),
  right: z.string().describe('右列名'),
  rows: z.array(
    z.object({
      label: z.string().describe('对比维度'),
      left: z.union([z.string(), z.number()]),
      right: z.union([z.string(), z.number()]),
      winner: z.enum(['left', 'right', 'tie']).nullable().describe('该维胜出方'),
    }),
  ),
});

const metricGridProps = z.object({
  title: z.string().nullable(),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      delta: z.string().nullable(),
    }),
  ),
});

const calloutProps = z.object({
  tone: z.enum(['info', 'success', 'warning', 'danger']),
  title: z.string().nullable(),
  text: z.string(),
});

const tagListProps = z.object({
  title: z.string().nullable(),
  tags: z.array(z.string()),
});

const progressProps = z.object({
  label: z.string().nullable(),
  value: z.number().min(0).max(100),
  display: z.string().nullable(),
});

const timelineProps = z.object({
  title: z.string().nullable(),
  items: z.array(
    z.object({ time: z.string().nullable(), title: z.string(), description: z.string().nullable() }),
  ),
});

const questionProps = z.object({
  title: z.string().nullable(),
  text: z.string(),
  options: z.array(z.object({ label: z.string(), hint: z.string().nullable() })),
  multiple: z.boolean().nullable(),
  submitLabel: z.string().nullable(),
});

// ── actions：生成 UI 上绑定的交互（ActionProvider handler 在 registry.tsx） ──

const runUiActionProps = z.object({
  id: z.string().describe('UI 动作 id（与页面注册动作一致，如 navigate/refresh）'),
  params: z.record(z.string(), z.unknown()).nullable(),
});

const answerQuestionProps = z.object({
  answer: z.string().describe('用户对 question 组件的回答文本'),
});

// ── catalog ─────────────────────────────────────────────────────────

export const catalog = defineCatalog(schema, {
  components: {
    'stat-card': {
      props: statCardProps,
      description: '单指标卡片：指标名 + 数值 + 涨跌',
    },
    'data-table': {
      props: dataTableProps,
      description: '数据表格：columns 表头 + rows 行',
    },
    'ranking': {
      props: rankingProps,
      description: '排行榜：名次 + 名称 + 数值 + 趋势（热搜/销量/达人榜）',
    },
    'compare': {
      props: compareProps,
      description: '左右对比卡：多维度 A vs B，可标记每维胜出方',
    },
    'metric-grid': {
      props: metricGridProps,
      description: '指标网格：多个关键数字指标紧凑组合（一排两个）',
    },
    'callout': {
      props: calloutProps,
      description: '语义提示块：info/success/warning/danger 四色',
    },
    'tag-list': {
      props: tagListProps,
      description: '关键词标签墙',
    },
    'progress': {
      props: progressProps,
      description: '进度条：label + value(0-100) + display',
    },
    'timeline': {
      props: timelineProps,
      description: '时间线：阶段/步骤/事件序列',
    },
    'question': {
      props: questionProps,
      description: '向人类提问并提供选项（单选/多选），提交后触发 answerQuestion action 回传对话',
      slots: ['default'],
    },
  },
  actions: {
    runUiAction: {
      params: runUiActionProps,
      description: '触发一个已注册的页面 UI 动作（导航/刷新/筛选等）',
    },
    answerQuestion: {
      params: answerQuestionProps,
      description: '把用户对 question 组件的选择/回答回传给 Agent 继续',
    },
  },
});

export type GenUICatalog = typeof catalog;
