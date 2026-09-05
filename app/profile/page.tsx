import { ProfileUsageIsland } from "./islands/usage-island";

/** 个人工作台：Supabase 式用量看板（服务健康 + 用量 + 配额），真实数据。 */
export default function ProfilePage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-base font-semibold">个人工作台</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          用量看板与系统健康状态（对标 Supabase 项目概览）。计费/配额正式化待 SaaS 版上线。
        </p>
      </div>
      <ProfileUsageIsland />
    </main>
  );
}