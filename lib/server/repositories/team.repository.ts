/**
 * FlowMind RAK — Team Repository
 * 动态组建的 Agent 团队（team + team_members），供协同拓扑按团队分组。
 */
import { prisma } from "../db";
import type { Team, TeamMember } from "@/lib/shared/types";

interface TeamRow {
  id: string;
  name: string;
  goal: string;
  leader_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  team_id: string;
  agent_id: string;
  role: string;
  joined_at: string;
}

function mapTeam(row: TeamRow, members: TeamMember[]): Team {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    leaderAgentId: row.leader_agent_id,
    createdAt: row.created_at,
    members,
  };
}

export async function createTeam(data: {
  id?: string;
  name: string;
  goal: string;
  leaderAgentId?: string | null;
  memberAgentIds?: string[];
}): Promise<Team> {
  const id = data.id ?? `team-${Date.now()}`;
  const row = (await prisma.teams.create({
    data: {
      id,
      name: data.name,
      goal: data.goal,
      leader_agent_id: data.leaderAgentId ?? null,
    },
  })) as unknown as TeamRow;

  const members: TeamMember[] = [];
  if (data.memberAgentIds && data.memberAgentIds.length > 0) {
    await prisma.team_members.createMany({
      data: data.memberAgentIds.map((agentId) => ({ team_id: id, agent_id: agentId, role: "member" })),
      skipDuplicates: true,
    });
    members.push(...data.memberAgentIds.map((agentId) => ({ agentId, role: "member", joinedAt: row.created_at })));
  }
  return mapTeam(row, members);
}

export async function listTeams(): Promise<Team[]> {
  const teams = (await prisma.teams.findMany({ orderBy: { created_at: "asc" } })) as unknown as TeamRow[];
  const members = (await prisma.team_members.findMany()) as unknown as MemberRow[];
  return teams.map((t) =>
    mapTeam(
      t,
      members
        .filter((m) => m.team_id === t.id)
        .map((m) => ({ agentId: m.agent_id, role: m.role, joinedAt: m.joined_at })),
    ),
  );
}

export async function getTeamById(id: string): Promise<Team | null> {
  const row = (await prisma.teams.findUnique({ where: { id } })) as unknown as TeamRow | null;
  if (!row) return null;
  const members = (await prisma.team_members.findMany({ where: { team_id: id } })) as unknown as MemberRow[];
  return mapTeam(
    row,
    members.map((m) => ({ agentId: m.agent_id, role: m.role, joinedAt: m.joined_at })),
  );
}

export async function addTeamMembers(teamId: string, agentIds: string[], role = "member"): Promise<Team | null> {
  const team = await prisma.teams.findUnique({ where: { id: teamId } });
  if (!team) return null;
  await prisma.team_members.createMany({
    data: agentIds.map((agentId) => ({ team_id: teamId, agent_id: agentId, role })),
    skipDuplicates: true,
  });
  await prisma.teams.update({ where: { id: teamId }, data: { updated_at: new Date().toISOString() } });
  return getTeamById(teamId);
}

export async function removeTeamMembers(teamId: string, agentIds: string[]): Promise<Team | null> {
  const team = await prisma.teams.findUnique({ where: { id: teamId } });
  if (!team) return null;
  await prisma.team_members.deleteMany({
    where: { team_id: teamId, agent_id: { in: agentIds } },
  });
  await prisma.teams.update({ where: { id: teamId }, data: { updated_at: new Date().toISOString() } });
  return getTeamById(teamId);
}

export async function updateTeamLeader(teamId: string, leaderAgentId: string | null): Promise<Team | null> {
  await prisma.teams.update({
    where: { id: teamId },
    data: { leader_agent_id: leaderAgentId, updated_at: new Date().toISOString() },
  });
  return getTeamById(teamId);
}

export async function deleteTeam(teamId: string): Promise<boolean> {
  await prisma.team_members.deleteMany({ where: { team_id: teamId } });
  await prisma.teams.delete({ where: { id: teamId } });
  return true;
}

/** 供拓扑用：agentId → 团队名列表 */
export async function getAgentTeamMap(): Promise<Map<string, string[]>> {
  const members = (await prisma.team_members.findMany()) as unknown as MemberRow[];
  const teams = (await prisma.teams.findMany()) as unknown as TeamRow[];
  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  const map = new Map<string, string[]>();
  for (const m of members) {
    const name = nameById.get(m.team_id);
    if (!name) continue;
    const arr = map.get(m.agent_id) ?? [];
    arr.push(name);
    map.set(m.agent_id, arr);
  }
  return map;
}
