// lib/journeys/registry.ts
// 旅程聚合点：与 workspaces registry 同构——新增旅程 = manifests/ 加文件 + 数组登记一行。
import type { JourneyManifest } from "./types";
import { contentPublishJourney } from "./manifests/content-publish";
import { listingLaunchJourney } from "./manifests/listing-launch";
import { skeletonJourneys } from "./manifests/skeletons";

export const journeys: JourneyManifest[] = [
  contentPublishJourney,
  listingLaunchJourney,
  ...skeletonJourneys,
].sort((a, b) => a.order - b.order);

export function getJourneyById(id: string): JourneyManifest | undefined {
  return journeys.find((j) => j.id === id);
}

export function getEnabledJourneys(): JourneyManifest[] {
  return journeys.filter((j) => j.enabled);
}

/** 步骤在旅程中的序号（1-based） */
export function stepIndexOf(journey: JourneyManifest, stepId: string): number {
  return journey.steps.findIndex((s) => s.id === stepId) + 1;
}
