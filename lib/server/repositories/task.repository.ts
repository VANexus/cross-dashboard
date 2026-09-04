/**
 * FlowMind RAK — Task Repository
 * Data access for tasks and task steps（Prisma Client 版）
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { Task, TaskStep } from "@/lib/shared/types";
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

async function getStepsForTask(taskId: string): Promise<TaskStep[]> {
  const rows = await prisma.task_steps.findMany({
    where: { task_id: taskId },
    orderBy: { sort_order: "asc" },
  });
  return (rows as StepRow[] ?? []).map(mapStep);
}

export async function getTasks(filters?: {
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Task>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const where: Prisma.tasksWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;

  const [total, rows] = await Promise.all([
    prisma.tasks.count({ where }),
    prisma.tasks.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: pageSize,
      skip: offset,
    }),
  ]);

  const items: Task[] = [];
  for (const row of rows as TaskRow[]) {
    const steps = await getStepsForTask(row.id);
    items.push(mapTask(row, steps));
  }

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
  const row = await prisma.tasks.findUnique({ where: { id } });
  if (!row) return null;
  const steps = await getStepsForTask(id);
  return mapTask(row as TaskRow, steps);
}

export async function createTask(data: {
  title: string;
  description?: string;
  priority?: string;
  assignedAgents?: string[];
}): Promise<Task> {
  const id = `task-${Date.now()}`;
  await prisma.tasks.create({
    data: {
      id,
      title: data.title,
      description: data.description ?? "",
      status: "pending",
      priority: data.priority ?? "medium",
      assigned_agents: JSON.stringify(data.assignedAgents ?? []),
    },
  });

  const defaultSteps = [
    { id: "s1", name: "数据采集", sort_order: 0 },
    { id: "s2", name: "分析处理", sort_order: 1 },
    { id: "s3", name: "结果生成", sort_order: 2 },
  ];
  await prisma.task_steps.createMany({
    data: defaultSteps.map((step) => ({
      id: step.id,
      task_id: id,
      name: step.name,
      status: "pending",
      agent_id: "",
      sort_order: step.sort_order,
    })),
  });

  return (await getTaskById(id))!;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
  const updateData: Prisma.tasksUpdateInput = { updated_at: new Date().toISOString() };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "completed") updateData.completed_at = new Date().toISOString();
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.output !== undefined) updateData.output = data.output;
  if (data.assignedAgents !== undefined) updateData.assigned_agents = JSON.stringify(data.assignedAgents);

  await prisma.tasks.update({ where: { id }, data: updateData });
  return getTaskById(id);
}

export async function deleteTask(id: string): Promise<boolean> {
  try {
    // deleteMany 对零行不抛错，保持旧实现「删除不存在的任务也返回 true」的语义
    await prisma.tasks.deleteMany({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function updateTaskStep(taskId: string, stepId: string, data: Partial<TaskStep>): Promise<TaskStep | null> {
  const updateData: Prisma.task_stepsUpdateManyMutationInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "running") updateData.started_at = new Date().toISOString();
    if (data.status === "completed") updateData.completed_at = new Date().toISOString();
  }
  if (data.agentId !== undefined) updateData.agent_id = data.agentId;
  if (data.output !== undefined) updateData.output = data.output;

  if (Object.keys(updateData).length === 0) return null;

  // updateMany 对零行不抛错（等价旧 UPDATE ... WHERE 复合条件），随后回读确认存在
  await prisma.task_steps.updateMany({
    where: { task_id: taskId, id: stepId },
    data: updateData,
  });

  const row = await prisma.task_steps.findFirst({
    where: { task_id: taskId, id: stepId },
  });
  return row ? mapStep(row as StepRow) : null;
}
