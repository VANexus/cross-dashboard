/**
 * lib/mastra/index.ts
 *
 * Mastra 实例(嵌入 Next.js 进程,无独立服务):注册 workflows。
 * agents 可后置;本轮以 workflows + tools 为主(见 web-agent-mastra-architecture.md P3)。
 *
 * activeRuns:跨请求 suspend/resume 需要持有 Run 实例(进程内注册表)。
 * start 时写入,resume 时取用,终态(success/failed)后移除;suspended 保留等确认。
 */
import { Mastra } from '@mastra/core';
import type { Run } from '@mastra/core/workflows';
import { b2bDailyTrendsWorkflow } from './workflows/b2b-daily-trends';
import { listingPipelineWorkflow } from './workflows/listing-pipeline';

export const mastra = new Mastra({
  workflows: {
    'b2b-daily-trends': b2bDailyTrendsWorkflow,
    'listing-pipeline': listingPipelineWorkflow,
  },
  logger: false,
});

export type WorkflowId = 'b2b-daily-trends' | 'listing-pipeline';

export const WORKFLOW_IDS: WorkflowId[] = ['b2b-daily-trends', 'listing-pipeline'];

/** 类型擦除的 Run(跨请求注册表用)。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 刻意类型擦除：跨 workflow 通用运行句柄
export type AnyRun = Run<any, any, any, any, any, any>;

export const activeRuns = new Map<string, AnyRun>();
