import { prisma } from "../lib/server/db";
(async () => {
  const cfg = await prisma.ai_config.findMany();
  console.log("ai_config rows:", cfg.length);
  cfg.forEach((r: any) => console.log(" ", r.key, "=", String(r.value).slice(0, 40)));
  const [j, m, rk, t] = await Promise.all([
    prisma.agent_journal.count({ where: { agent_id: "sentinel-001" } }),
    prisma.rak_messages.count({ where: { OR: [{ from_agent: "sentinel-001" }, { to_agent: "sentinel-001" }] } }),
    prisma.risk_events.count(),
    prisma.tasks.count(),
  ]);
  console.log("sentinel journal/messages, risks, tasks:", j, m, rk, t);
  const agents = await prisma.agents.findMany({ orderBy: { id: "asc" } });
  agents.forEach((r: any) => {
    let c = "?";
    try { const jj = JSON.parse(r.config); c = jj.cycleConfig?.intervalMs + "/" + jj.cycleConfig?.enabled; } catch {}
    console.log("agent", r.id, "status=" + r.status, "cycle=" + c);
  });
  await prisma.$disconnect();
})().catch((e) => { console.error("PROBE ERR:", e.message); process.exit(1); });
