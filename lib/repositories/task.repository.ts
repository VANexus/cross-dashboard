/**
 * FlowMind RAK — Task Repository
 * Data access for tasks and task steps
 */
import { getDb } from "../db";
import type { Task, TaskStep } from "../types";
import { paginatedQuery, type PaginatedResult, parseJsonField } from "./base";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_agents: string;
  output: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface StepRow {
  id: string;
  task_id: string;
  name: string;
  status: string;
  agent_id: string;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
  output: string | null;
}

function mapTask(row: TaskRow, steps: TaskStep[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    assignedAgents: parseJsonField<string[]>(row.assigned_agents, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    output: row.output ?? undefined,
    steps,
  };
}

function mapStep(row: StepRow): TaskStep {
  return {
    id: row.id,
    name: row.name,
    status: row.status as TaskStep["status"],
    agentId: row.agent_id,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    output: row.output ?? undefined,
  };
}

function getStepsForTask(db: ReturnType<typeof getDb>, taskId: string): TaskStep[] {
  const rows = db.query("SELECT * FROM task_steps WHERE task_id = ? ORDER BY sort_order").all(taskId) as StepRow[];
  return rows.map(mapStep);
}

export function getTasks(filters?: {
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}): PaginatedResult<Task> {
  const db = getDb();
  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.status) { where += " AND status = ?"; params.push(filters.status); }
  if (filters?.priority) { where += " AND priority = ?"; params.push(filters.priority); }

  const result = paginatedQuery<TaskRow>("tasks", where, params, filters?.page ?? 1, filters?.pageSize ?? 20);

  return {
    items: result.items.map((row) => mapTask(row, getStepsForTask(db, row.id))),
    pagination: result.pagination,
  };
}

export function getTaskById(id: string): Task | null {
  const db = getDb();
  const row = db.query("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | null;
  if (!row) return null;
  return mapTask(row, getStepsForTask(db, id));
}

export function createTask(data: {
  title: string;
  description?: string;
  priority?: string;
  assignedAgents?: string[];
}): Task {
  const db = getDb();
  const id = `task-${Date.now()}`;
  db.run(
    `INSERT INTO tasks (id, title, description, status, priority, assigned_agents)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [id, data.title, data.description ?? "", data.priority ?? "medium",
    JSON.stringify(data.assignedAgents ?? [])],
  );

  // Create default steps based on task type
  const defaultSteps = [
    { id: "s1", name: "数据采集", sort_order: 0 },
    { id: "s2", name: "分析处理", sort_order: 1 },
    { id: "s3", name: "结果生成", sort_order: 2 },
  ];
  const stepStmt = db.prepare(
    `INSERT INTO task_steps (id, task_id, name, status, agent_id, sort_order) VALUES (?, ?, ?, 'pending', '', ?)`,
  );
  for (const step of defaultSteps) {
    stepStmt.run(step.id, id, step.name, step.sort_order);
  }

  return getTaskById(id)!;
}

export function updateTask(id: string, data: Partial<Task>): Task | null {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (data.title !== undefined) { sets.push("title = ?"); params.push(data.title); }
  if (data.description !== undefined) { sets.push("description = ?"); params.push(data.description); }
  if (data.status !== undefined) {
    sets.push("status = ?"); params.push(data.status);
    if (data.status === "completed") sets.push("completed_at = datetime('now')");
  }
  if (data.priority !== undefined) { sets.push("priority = ?"); params.push(data.priority); }
  if (data.output !== undefined) { sets.push("output = ?"); params.push(data.output); }
  if (data.assignedAgents !== undefined) { sets.push("assigned_agents = ?"); params.push(JSON.stringify(data.assignedAgents)); }

  params.push(id);
  db.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, params as any[]);
  return getTaskById(id);
}

export function deleteTask(id: string): boolean {
  const db = getDb();
  const changes = db.run("DELETE FROM tasks WHERE id = ?", [id]).changes;
  return changes > 0;
}

export function updateTaskStep(taskId: string, stepId: string, data: Partial<TaskStep>): TaskStep | null {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { sets.push("name = ?"); params.push(data.name); }
  if (data.status !== undefined) {
    sets.push("status = ?"); params.push(data.status);
    if (data.status === "running") sets.push("started_at = datetime('now')");
    if (data.status === "completed") sets.push("completed_at = datetime('now')");
  }
  if (data.agentId !== undefined) { sets.push("agent_id = ?"); params.push(data.agentId); }
  if (data.output !== undefined) { sets.push("output = ?"); params.push(data.output); }

  if (sets.length === 0) return null;

  params.push(taskId, stepId);
  db.run(`UPDATE task_steps SET ${sets.join(", ")} WHERE task_id = ? AND id = ?`, params as any[]);

  const row = db.query("SELECT * FROM task_steps WHERE task_id = ? AND id = ?").get(taskId, stepId) as StepRow | null;
  return row ? mapStep(row) : null;
}
