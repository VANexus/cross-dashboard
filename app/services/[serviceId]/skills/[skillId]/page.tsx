/**
 * FlowMind — 动态技能页（服务发现plus）
 *
 * 通用渲染器：不再为每个工作流硬编码页面，
 * 而是根据 discovered skill 的 inputSchema 动态生成输入表单，
 * 调用技能，并展示结果。
 *
 * 路由：/services/[serviceId]/skills/[skillId]
 *
 * 这是"通用前端"的关键——接入新后端后，其技能自动出现
 * 在导航中，点击即可使用，无需前端改代码。
 */
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ServiceSkillView } from "@/components/services/service-skill-view";
import type { Metadata } from "next";

export interface ServiceSkillPageProps {
  params: Promise<{ serviceId: string; skillId: string }>;
}

export async function generateMetadata({
  params,
}: ServiceSkillPageProps): Promise<Metadata> {
  const { skillId } = await params;
  return {
    title: `${skillId} — FlowMind 服务`,
    description: `技能 ${skillId} 的执行页`,
  };
}

function SkillViewSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="h-4 w-72 skeleton rounded" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 skeleton rounded-lg" />
        <div className="h-64 skeleton rounded-lg" />
      </div>
    </div>
  );
}

export default function ServiceSkillPage({
  params,
}: ServiceSkillPageProps) {
  // cache-components：async page 顶层 await params 属 uncached，须落在 Suspense 内
  return (
    <Suspense fallback={<SkillViewSkeleton />}>
      <ServiceSkillLoader params={params} />
    </Suspense>
  );
}

// cache-components 要求动态路由提供至少一个真实样本供 build-time validation。
export async function generateStaticParams(): Promise<Array<{ serviceId: string; skillId: string }>> {
  return [{ serviceId: "service-sample", skillId: "skill-sample" }];
}

async function ServiceSkillLoader({ params }: ServiceSkillPageProps) {
  const { serviceId, skillId } = await params;

  // 基础路由守卫：id 格式校验
  if (!serviceId || !skillId) {
    notFound();
  }

  return <ServiceSkillView serviceId={serviceId} skillId={skillId} />;
}
