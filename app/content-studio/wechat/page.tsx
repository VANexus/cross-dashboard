import { Suspense } from "react";
import { WechatPublishIsland } from "./islands/wechat-publish-island";

function WechatSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg skeleton" />
        <div className="space-y-1.5">
          <div className="h-5 w-40 skeleton rounded" />
          <div className="h-3 w-64 skeleton rounded" />
        </div>
      </div>
      <div className="h-10 skeleton rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 skeleton rounded-lg" />
        <div className="h-64 skeleton rounded-lg" />
      </div>
    </div>
  );
}

export default function WechatPublishPage() {
  return (
    <Suspense fallback={<WechatSkeleton />}>
      <WechatPublishIsland />
    </Suspense>
  );
}
