/**
 * FlowMind RAK — Crawler Types
 */

export interface ProductData {
  asin: string;
  title: string;
  price: number;
  rating: number;
  reviewCount: number;
  bsr: number;
  category: string;
  imageUrl: string;
  url: string;
}

export interface KeywordData {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
  trend: number[];
}

export interface CrawlerResult<T> {
  success: boolean;
  data: T[];
  error?: string;
  timestamp: string;
}
