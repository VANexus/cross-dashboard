import { Suspense } from "react";
import { CrawlerClient } from "./crawler-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CrawlerService } from "@/lib/services/crawler.service";

function CrawlerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-32 skeleton rounded" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="h-4 w-24 skeleton rounded" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-3 w-full skeleton rounded" />
            <div className="h-3 w-3/4 skeleton rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function CrawlerData() {
  // 直接调用内部 service（不再 HTTP 自 fetch），cacheComponents 下走标准动态渲染
  const service = new CrawlerService();

  let status = { available: false, stores: [] as never[], running: [] as never[] };
  let results: never[] = [];

  try {
    const [s, r] = await Promise.all([
      service.getStatus(),
      service.getRecentResults(20),
    ]);
    status = (s as typeof status) ?? status;
    results = (r as typeof results) ?? results;
  } catch {
    // Bridge not available — use defaults
  }

  return <CrawlerClient initialStatus={status} initialResults={results} />;
}

export default function CrawlerPage() {
  return (
    <Suspense fallback={<CrawlerSkeleton />}>
      <CrawlerData />
    </Suspense>
  );
}
