/**
 * FlowMind RAK — Task Service
 * Business logic for task orchestration with RAK DAG
 */
import * as repo from "../repositories/task.repository";
import * as agentRepo from "../repositories/agent.repository";
import * as journalRepo from "../repositories/journal.repository";
import * as memoryRepo from "../repositories/memory.repository";
import { agentEventBus } from "../agent-runtime/event-bus";
import { getRAKEngine } from "../rak";
import type { Task, TaskStep, Pagination } from "@/lib/shared/types";

export class TaskService {
  private rak = getRAKEngine();

  async list(filters?: {
    status?: string;
    priority?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Task[]; pagination: Pagination }> {
    return await repo.getTasks(filters);
  }

  async getById(id: string): Promise<Task | null> {
    return await repo.getTaskById(id);
  }

  async create(data: {
    title: string;
    description?: string;
    priority?: string;
    assignedAgents?: string[];
  }): Promise<Task> {
    const task = await repo.createTask(data);

    const definition = {
      nodes: task.steps.map((step) => ({
        id: step.id,
        name: step.name,
        type: "task" as const,
        assignedAgent: step.agentId || undefined,
      })),
      edges: task.steps.slice(1).map((step, i) => ({
        from: task.steps[i].id,
        to: step.id,
      })),
    };

    this.rak.mesh.createDAG(task.id, definition);

    if (data.assignedAgents?.length) {
      this.rak.coordinator.dispatchTask(task.id, data.assignedAgents);
    }

    return task;
  }

  async update(id: string, data: Partial<Task>): Promise<Task | null> {
    const task = await repo.updateTask(id, data);

    if (data.status === "running" && task) {
      const readyNodes = await this.rak.mesh.getReadyNodes(id);
      for (const node of readyNodes) {
        if (node.type !== "start" && node.type !== "end") {
          await this.rak.mesh.startNode(node.id, id);
        }
      }
    }

    if (data.status === "completed" && task) {
      const dag = await this.rak.mesh.getDAG(id);
      for (const node of dag) {
        if (node.status === "pending" || node.status === "running") {
          await this.rak.mesh.completeNode(node.id, id);
        }
      }

      this.onTaskCompleted(task).catch(console.error);
    }

    return task;
  }

  async delete(id: string): Promise<boolean> {
    return await repo.deleteTask(id);
  }

  async updateStep(taskId: string, stepId: string, data: Partial<TaskStep>): Promise<TaskStep | null> {
    const step = await repo.updateTaskStep(taskId, stepId, data);

    if (step && data.status) {
      const dagNodeId = `${taskId}-${stepId}`;
      if (data.status === "running") this.rak.mesh.startNode(dagNodeId, taskId);
      if (data.status === "completed") this.rak.mesh.completeNode(dagNodeId, taskId);
      if (data.status === "failed") this.rak.mesh.failNode(dagNodeId, taskId, "Step failed");
    }

    return step;
  }

  private async onTaskCompleted(task: Task): Promise<void> {
    const agents = task.assignedAgents ?? [];
    const now = new Date().toISOString();

    for (const agentId of agents) {
      try {
        const agent = await agentRepo.getAgentById(agentId);
        if (agent) {
          const totalTasks = agent.taskCount + 1;
          const successRate = Math.round(((agent.successRate * agent.taskCount + 100) / totalTasks) * 10) / 10;
          await agentRepo.updateAgentStats(agentId, { taskCount: totalTasks, successRate });
        }
      } catch { /* agent may not exist */ }

      try {
        await journalRepo.addEntry({
          agentId,
          type: "decision",
          content: `完成任务「${task.title}」`,
          context: { taskId: task.id, taskTitle: task.title },
        });
      } catch { /* non-critical */ }

      try {
        await memoryRepo.createMemory({
          zone: "agent",
          title: `完成: ${task.title}`,
          content: task.description || `任务「${task.title}」已成功完成`,
          type: "script",
          tags: ["task-completion", task.id],
          agentId,
        });
      } catch { /* non-critical */ }

      agentEventBus.emit(agentId, {
        type: "decision",
        agentId,
        data: { action: "task_completed", taskId: task.id, taskTitle: task.title },
        timestamp: now,
      });
    }
  }
}
