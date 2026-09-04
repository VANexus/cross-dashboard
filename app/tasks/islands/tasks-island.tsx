import { TasksClient } from "../tasks-client";
import { TaskService, AgentService } from "@/lib/server/services";
import { getDbAsync } from "@/lib/server/db";
import type { Task, Agent } from "@/lib/shared/types";

export async function TasksIsland() {
  await getDbAsync();
  const taskService = new TaskService();
  const agentService = new AgentService();
  const tasks: Task[] = (await taskService.list()).items;
  const agents: Agent[] = await agentService.list();
  return <TasksClient initialTasks={tasks} agents={agents} />;
}
