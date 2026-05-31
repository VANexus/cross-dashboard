import { Suspense } from "react";
import { CrawlerClient } from "./crawler-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  let status = { available: false, stores: [] as never[], running: [] as never[] };
  let results: never[] = [];

  try {
    const [statusRes, resultsRes] = await Promise.all([
      fetch(`${baseUrl}/api/crawler/stores`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/crawler/results?limit=20`, { cache: "no-store" }),
    ]);
    const statusJson = await statusRes.json();
    const resultsJson = await resultsRes.json();
    status = statusJson.data ?? status;
    results = resultsJson.data ?? results;
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
