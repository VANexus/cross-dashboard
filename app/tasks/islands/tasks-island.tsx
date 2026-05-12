import { backendGet } from "@/lib/backend-client";
import { TasksClient } from "../tasks-client";
import type { Task, Agent } from "@/lib/types";

export async function TasksIsland() {
  const [tasksRes, agentsRes] = await Promise.all([
    backendGet("/api/tasks"),
    backendGet("/api/agents"),
  ]);
  const tasks: Task[] = tasksRes.data ?? [];
  const agents: Agent[] = agentsRes.data ?? [];
  return <TasksClient initialTasks={tasks} agents={agents} />;
}
