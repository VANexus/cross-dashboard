/**
 * FlowMind — 0006: 生图项目画布（ComfyUI 式版本/分支流水线）
 * 每个节点 = 一次生成的「版本」；root_id 标识所属项目（根节点即项目），
 * parent_id 指向来源版本（分支）。支持：多轮迭代（同线续作）、
 * 分支（在旧版本基础上开新线）、参数与提示词版本留存。
 * 幂等：IF NOT EXISTS。
 */
export const IMAGE_PROJECTS_SQL = `
CREATE TABLE IF NOT EXISTS wf_image_projects (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  root_id    TEXT NOT NULL,
  parent_id  TEXT,
  branch_tag TEXT NOT NULL DEFAULT '',
  depth      INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  prompt     TEXT NOT NULL DEFAULT '',
  negative   TEXT NOT NULL DEFAULT '',
  params     TEXT NOT NULL DEFAULT '{}',
  image_url  TEXT NOT NULL DEFAULT '',
  thumbnail  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_wf_image_projects_root
  ON wf_image_projects(root_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_wf_image_projects_parent
  ON wf_image_projects(parent_id);
`;