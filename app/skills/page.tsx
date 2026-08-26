import { Suspense } from "react";
import { SkillsClient } from "./skills-client";
import SkillsLoading from "./loading";

/**
 * FlowMind — 能力中心（通用技能页）
 *
 * 所有技能共用一套 Schema 驱动的渲染器，无专属页面。
 */
export default function SkillsPage() {
  return (
    <Suspense fallback={<SkillsLoading />}>
      <SkillsClient />
    </Suspense>
  );
}
