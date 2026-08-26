import { VideoLocalizationIsland } from "./islands/video-localization-island";

export default function VideoLocalizationPage() {
  // 路由级 loading.tsx 已提供 Suspense 边界，这里不再包一层冗余的内层 Suspense
  return <VideoLocalizationIsland />;
}
