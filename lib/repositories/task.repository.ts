/**
 * FlowMind RAK — Task Repository
 * Data access for tasks and task steps
 */
import { getSupabase } from "../db";
import type { Task, TaskStep } from "../types";
import { type PaginatedResult, parseJsonField } from "./base";

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

async function getStepsForTask(sb: ReturnType<typeof getSupabase>, taskId: string): Promise<TaskStep[]> {
  const { data } = await sb
    .from("task_steps")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  return (data as StepRow[] ?? []).map(mapStep);
}

export async function getTasks(filters?: {
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Task>> {
  const sb = getSupabase();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = sb.from("tasks").select("*", { count: "exact" });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.priority) query = query.eq("priority", filters.priority);

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const rows = (data as TaskRow[] ?? []);
  const items: Task[] = [];
  for (const row of rows) {
    const steps = await getStepsForTask(sb, row.id);
    items.push(mapTask(row, steps));
  }
  const total = count ?? 0;

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getTaskById(id: string): Promise<Task | null> {
  const sb = getSupabase();
  const { data } = await sb.from("tasks").select("*").eq("id", id).maybeSingle();
  const row = data as TaskRow | null;
  if (!row) return null;
  const steps = await getStepsForTask(sb, id);
  return mapTask(row, steps);
}

export async function createTask(data: {
  title: string;
  description?: string;
  priority?: string;
  assignedAgents?: string[];
}): Promise<Task> {
  const sb = getSupabase();
  const id = `task-${Date.now()}`;
  await sb.from("tasks").insert({
    id,
    title: data.title,
    description: data.description ?? "",
    status: "pending",
    priority: data.priority ?? "medium",
    assigned_agents: JSON.stringify(data.assignedAgents ?? []),
  });

  const defaultSteps = [
    { id: "s1", name: "数据采集", sort_order: 0 },
    { id: "s2", name: "分析处理", sort_order: 1 },
    { id: "s3", name: "结果生成", sort_order: 2 },
  ];
  for (const step of defaultSteps) {
    await sb.from("task_steps").insert({
      id: step.id,
      task_id: id,
      name: step.name,
      status: "pending",
      agent_id: "",
      sort_order: step.sort_order,
    });
  }

  return (await getTaskById(id))!;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
  const sb = getSupabase();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "completed") updateData.completed_at = new Date().toISOString();
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.output !== undefined) updateData.output = data.output;
  if (data.assignedAgents !== undefined) updateData.assigned_agents = JSON.stringify(data.assignedAgents);

  await sb.from("tasks").update(updateData).eq("id", id);
  return getTaskById(id);
}

export async function deleteTask(id: string): Promise<boolean> {
  const sb = getSupabase();
  const { error } = await sb.from("tasks").delete().eq("id", id);
  return !error;
}

export async function updateTaskStep(taskId: string, stepId: string, data: Partial<TaskStep>): Promise<TaskStep | null> {
  const sb = getSupabase();
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "running") updateData.started_at = new Date().toISOString();
    if (data.status === "completed") updateData.completed_at = new Date().toISOString();
  }
  if (data.agentId !== undefined) updateData.agent_id = data.agentId;
  if (data.output !== undefined) updateData.output = data.output;

  if (Object.keys(updateData).length === 0) return null;

  await sb.from("task_steps").update(updateData).eq("task_id", taskId).eq("id", stepId);

  const { data: row } = await sb
    .from("task_steps")
    .select("*")
    .eq("task_id", taskId)
    .eq("id", stepId)
    .maybeSingle();
  return row ? mapStep(row as StepRow) : null;
}
