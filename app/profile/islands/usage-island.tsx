import { getDashboardDataShared } from "@/lib/server/services/dashboard.service";
import { CreationsService, type CreationItem, type CreationType } from "@/lib/server/services/creations.service";
import { ProfileUsage } from "../profile-usage";

export interface ProfileCreations {
  counts: Record<CreationType, number>;
  recent: CreationItem[];
}

/** 个人页用量看板数据（SSR 真实数据）：系统总览 + 我的产物概览。 */
export async function ProfileUsageIsland() {
  const [dash, creations] = await Promise.all([
    getDashboardDataShared(),
    (async (): Promise<ProfileCreations> => {
      const svc = new CreationsService();
      const [counts, recent] = await Promise.all([svc.counts(), svc.list(6)]);
      return { counts, recent };
    })(),
  ]);
  return <ProfileUsage overview={dash.overview} creations={creations} />;
}