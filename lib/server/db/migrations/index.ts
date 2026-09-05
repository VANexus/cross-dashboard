/**
 * FlowMind — 数据库迁移清单（幂等水位：schema_migrations）
 * 0001_init.ts 由 supabase/migrations 转换而来（纯 PG DDL，无 RLS/grant/storage/auth）。
 */
import type { Migration } from "./types-migration";
import { INIT_SQL } from "./0001_init";
import { EVOLUTION_SOURCE_SQL } from "./0002_evolution_source";
import { AGENT_TEAMS_SQL } from "./0003_agent_teams";
import { WORKFLOW_RUNS_SQL } from "./0004_workflow_runs";
import { CONVERSATIONS_SQL } from "./0005_conversations";
import { IMAGE_PROJECTS_SQL } from "./0006_image_projects";

export type { Migration };

export const MIGRATIONS: Migration[] = [
  { id: "0001_init", sql: INIT_SQL },
  { id: "0002_evolution_source", sql: EVOLUTION_SOURCE_SQL },
  { id: "0003_agent_teams", sql: AGENT_TEAMS_SQL },
  { id: "0004_workflow_runs", sql: WORKFLOW_RUNS_SQL },
  { id: "0005_conversations", sql: CONVERSATIONS_SQL },
  { id: "0006_image_projects", sql: IMAGE_PROJECTS_SQL },
];
