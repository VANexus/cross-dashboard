import { TasksClient } from "../tasks-client";
import { TaskService, AgentService } from "@/lib/services";
import { getDbAsync } from "@/lib/db";
import type { Task, Agent } from "@/lib/types";

export async function TasksIsland() {
  await getDbAsync();
  const taskService = new TaskService();
  const agentService = new AgentService();
  const tasks: Task[] = taskService.list().items;
  const agents: Agent[] = agentService.list();
  return <TasksClient initialTasks={tasks} agents={agents} />;
}
