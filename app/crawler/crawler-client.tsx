"use client";

import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Globe,
  Store,
  Download,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Database,
} from "lucide-react";
import { useCrawlerStatus, useCrawlerResults, extractData } from "@/hooks/use-crawler";
import type { StoreStatus } from "@/hooks/use-crawler";
import type { CrawlResult } from "@/lib/services/crawler.service";

interface CrawlerClientProps {
  initialStatus: StoreStatus;
  initialResults: CrawlResult[];
}

export function CrawlerClient({ initialStatus, initialResults }: CrawlerClientProps) {
  const { data: status, refetch: refetchStatus } = useCrawlerStatus();
  const { data: results, refetch: refetchResults } = useCrawlerResults();
  const [extractUrl, setExtractUrl] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const displayStatus = status ?? initialStatus;
  const displayResults = results ?? initialResults;

  const handleExtract = async () => {
    if (!selectedStore || !extractUrl) return;
    setLoading(true);
    setMessage("");
    try {
      await extractData(selectedStore, extractUrl);
      setMessage("数据提取成功");
      refetchResults();
    } catch (err) {
      setMessage(`提取失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            爬虫中心
          </h1>
          <p className="text-muted-foreground text-sm">
            通过紫鸟浏览器提取店铺数据
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchStatus(); refetchResults(); }}>
          <RefreshCw className="h-4 w-4 mr-1" />
          刷新
        </Button>
      </div>

      {/* Bridge Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            紫鸟桥接状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <StatusDot
              status={displayStatus.available ? "success" : "danger"}
              pulse={displayStatus.available}
            />
            <span className="text-sm">
              {displayStatus.available ? "桥接已连接" : "桥接未连接 — 请启动紫鸟浏览器"}
            </span>
          </div>
          {displayStatus.available && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                已发现 {displayStatus.stores.length} 个店铺，{displayStatus.running.length} 个运行中
              </p>
              <div className="flex flex-wrap gap-2">
                {displayStatus.stores.map((store) => (
                  <Badge
                    key={store.storeId}
                    variant={selectedStore === store.storeId ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedStore(store.storeId)}
                  >
                    {store.storeName} ({store.platformName})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extract Tool */}
      {displayStatus.available && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              数据提取
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="输入要提取的URL (如 Amazon Seller Central, 店铺页面)"
                value={extractUrl}
                onChange={(e) => setExtractUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleExtract} disabled={loading || !selectedStore || !extractUrl}>
                {loading ? "提取中..." : "提取数据"}
              </Button>
            </div>
            {!selectedStore && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                请先在上方选择一个店铺
              </p>
            )}
            {message && (
              <p className={`text-xs flex items-center gap-1 ${message.includes("成功") ? "text-emerald-500" : "text-red-500"}`}>
                {message.includes("成功") ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            提取记录
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {displayResults.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displayResults.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无提取记录</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {displayResults.map((result, i) => (
                <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {result.storeName || result.storeId}
                      </Badge>
                      {result.url && (
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {new URL(result.url).hostname}
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(result.timestamp).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <pre className="text-[10px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap max-h-20">
                    {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2).slice(0, 500)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
