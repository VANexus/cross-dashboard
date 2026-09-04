/**
 * FlowMind — 爬虫域共享类型（lib/shared）
 *
 * F1 分层边界（2026-09-03）：客户端代码（hooks / client components）不得 import
 * `lib/server/**`——爬虫结果的 **类型契约** 提升到 shared 层，
 * 服务实现（lib/server/services/crawler.service.ts）从此处导入。
 */

export interface CrawlResult {
  storeId: string;
  storeName: string;
  platform: string;
  url: string;
  data: unknown;
  screenshot?: string;
  timestamp: string;
}
