/**
 * FlowMind — 0003: Agent 全动态化基础设施
 * - agent_templates：预设人格模板（现有 6 个固化为模板，供一句话动态生成参考）
 * - teams / team_members：动态组建的 Agent 团队（拓扑按团队分组）
 * 幂等：IF NOT EXISTS。
 */
export const AGENT_TEAMS_SQL = `
-- 预设 Agent 模板（一句话动态生成的参考底座）
CREATE TABLE IF NOT EXISTS agent_templates (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  config      TEXT NOT NULL DEFAULT '{}',
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

-- 动态组建的 Agent 团队
CREATE TABLE IF NOT EXISTS teams (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  goal            TEXT NOT NULL DEFAULT '',
  leader_agent_id TEXT,
  created_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at      TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_agent_id);

-- 团队成员（agent 可属多个团队）
CREATE TABLE IF NOT EXISTS team_members (
  team_id    TEXT NOT NULL,
  agent_id   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',
  joined_at  TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  PRIMARY KEY (team_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_agent ON team_members(agent_id);
`;
