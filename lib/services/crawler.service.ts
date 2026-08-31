/**
 * FlowMind — Crawler Service
 * Orchestrates Ziniao Browser to extract e-commerce store data
 */
import * as ziniao from "../ziniao/client";
import { getSupabase } from "../db";
import type { ZiniaoStore } from "../ziniao/client";

export interface CrawlResult {
  storeId: string;
  storeName: string;
  platform: string;
  url: string;
  data: unknown;
  screenshot?: string;
  timestamp: string;
}

export interface StoreStatus {
  available: boolean;
  stores: ZiniaoStore[];
  running: Array<{ storeId: string; storeName: string; debugPort: number }>;
}

export class CrawlerService {
  /** Check bridge availability and list stores */
  async getStatus(): Promise<StoreStatus> {
    const available = await ziniao.isBridgeAvailable();
    if (!available) {
      return { available: false, stores: [], running: [] };
    }

    const stores = await ziniao.listStores();
    let running: Array<{ storeId: string; storeName: string; debugPort: number }> = [];
    try {
      const data = await ziniao.extractData("running");
      running = (data as { items?: typeof running })?.items ?? [];
    } catch { /* ignore */ }

    return { available: true, stores, running };
  }

  /** Open a store and navigate to a URL */
  async openAndNavigate(storeId: string, url: string): Promise<CrawlResult> {
    await ziniao.openStore(storeId, url);
    await ziniao.visitPage(storeId, url);
    const content = await ziniao.getPageContent(storeId, "structured");

    return {
      storeId,
      storeName: "",
      platform: "",
      url,
      data: content,
      timestamp: new Date().toISOString(),
    };
  }

  /** Extract product listing data from a store page */
  async extractProductData(storeId: string, url: string): Promise<CrawlResult> {
    await ziniao.visitPage(storeId, url);

    // Extract structured data via JS injection
    const data = await ziniao.executeScript(storeId, `
      (() => {
        const products = [];
        // Common e-commerce selectors
        const items = document.querySelectorAll('[data-asin], .product-item, .s-result-item, .a-carousel-card');
        items.forEach((item, i) => {
          if (i >= 50) return; // limit
          const title = item.querySelector('h2, .product-title, .a-text-normal')?.textContent?.trim() || '';
          const price = item.querySelector('.a-price-whole, .price, .a-color-price')?.textContent?.trim() || '';
          const rating = item.querySelector('.a-icon-alt, .rating')?.textContent?.trim() || '';
          const img = item.querySelector('img')?.src || '';
          const link = item.querySelector('a')?.href || '';
          if (title) products.push({ title, price, rating, img, link });
        });
        return { products, url: location.href, title: document.title, timestamp: new Date().toISOString() };
      })()
    `);

    return {
      storeId,
      storeName: "",
      platform: "",
      url,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /** Extract order data from store dashboard */
  async extractOrderData(storeId: string): Promise<CrawlResult> {
    const data = await ziniao.executeScript(storeId, `
      (() => {
        const orders = [];
        // Try common order table selectors
        const rows = document.querySelectorAll('tr.order-row, .order-item, [data-order-id]');
        rows.forEach((row, i) => {
          if (i >= 100) return;
          const orderId = row.querySelector('.order-id, [data-order-id]')?.textContent?.trim() || '';
          const status = row.querySelector('.order-status, .status')?.textContent?.trim() || '';
          const total = row.querySelector('.order-total, .total')?.textContent?.trim() || '';
          const date = row.querySelector('.order-date, .date')?.textContent?.trim() || '';
          if (orderId) orders.push({ orderId, status, total, date });
        });
        return { orders, url: location.href, title: document.title, timestamp: new Date().toISOString() };
      })()
    `);

    return {
      storeId,
      storeName: "",
      platform: "",
      url: "",
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /** Take a screenshot of current page */
  async screenshot(storeId: string, fullPage = false): Promise<string> {
    const result = await ziniao.takeScreenshot(storeId, fullPage) as { path?: string; base64?: string };
    return result.path || result.base64 || "";
  }

  /** Multi-step automation for data extraction */
  async runExtractionAutomation(storeId: string, steps: Array<Record<string, unknown>>): Promise<unknown> {
    return ziniao.runAutomation(steps);
  }

  /** Save crawl result to database */
  async saveResult(result: CrawlResult): Promise<void> {
    const sb = getSupabase();
    const id = `crawl-${Date.now()}`;
    await sb.from("crawl_results").insert({
      id,
      store_id: result.storeId,
      store_name: result.storeName,
      platform: result.platform,
      url: result.url,
      data: JSON.stringify(result.data),
      timestamp: result.timestamp,
    });
  }

  /** Get recent crawl results */
  async getRecentResults(limit = 20): Promise<CrawlResult[]> {
    const sb = getSupabase();
    const { data } = await sb
      .from("crawl_results")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    const rows = (data ?? []) as Array<{
      id: string; store_id: string; store_name: string; platform: string;
      url: string; data: string; timestamp: string;
    }>;

    return rows.map((r) => ({
      storeId: r.store_id,
      storeName: r.store_name,
      platform: r.platform,
      url: r.url,
      data: (() => { try { return JSON.parse(r.data); } catch { return r.data; } })(),
      timestamp: r.timestamp,
    }));
  }
}
