import { connection } from "next/server";
import { getDbAsync } from "@/lib/server/db";
import { B2BService } from "@/lib/server/services";
import { B2BImageSkillsClient } from "../b2b-image-skills-client";

/**
 * SSR island：初次渲染直接读库（Skill 列表），
 * 客户端用 useImageSkills 做实时刷新与 mutation 后同步。
 */
export async function ImageSkillsIsland() {
  await connection();
  await getDbAsync();
  const service = new B2BService();
  return <B2BImageSkillsClient initialSkills={await service.getImageSkills()} />;
}
