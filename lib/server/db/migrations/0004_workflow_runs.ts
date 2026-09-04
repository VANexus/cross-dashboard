/**
 * FlowMind — 0004: 动态工作流运行日志
 * 工作流不再预设，全部由 Agent 在对话中 plan_workflow 规划、run_workflow 执行；
 * 每次执行落一条真实运行记录，支撑「工作流状态」面板的真实数据（无任何预设假数据）。
 * 幂等：IF NOT EXISTS。
 */
export const WORKFLOW_RUNS_SQL = `
CREATE TABLE IF NOT EXISTS wf_workflow_runs (
  id           TEXT PRIMARY KEY,
  workflow_id  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',
  steps        TEXT NOT NULL DEFAULT '[]',
  summary      TEXT NOT NULL DEFAULT '',
  created_by   TEXT NOT NULL DEFAULT 'agent',
  started_at   TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wf_workflow_runs_wf
  ON wf_workflow_runs(workflow_id, started_at desc);
`;
