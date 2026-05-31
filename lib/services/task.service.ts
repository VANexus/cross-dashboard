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
import type { Task, TaskStep, Pagination } from "../types";

export class TaskService {
  private rak = getRAKEngine();

  list(filters?: {
    status?: string;
    priority?: string;
    page?: number;
    pageSize?: number;
  }): { items: Task[]; pagination: Pagination } {
    return repo.getTasks(filters);
  }

  getById(id: string): Task | null {
    return repo.getTaskById(id);
  }

  create(data: {
    title: string;
    description?: string;
    priority?: string;
    assignedAgents?: string[];
  }): Task {
    const task = repo.createTask(data);

    // Create RAK DAG for the task
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

    // Dispatch to agents
    if (data.assignedAgents?.length) {
      this.rak.coordinator.dispatchTask(task.id, data.assignedAgents);
    }

    return task;
  }

  update(id: string, data: Partial<Task>): Task | null {
    const task = repo.updateTask(id, data);

    // If status changed to running, start DAG execution
    if (data.status === "running" && task) {
      const readyNodes = this.rak.mesh.getReadyNodes(id);
      for (const node of readyNodes) {
        if (node.type !== "start" && node.type !== "end") {
          this.rak.mesh.startNode(node.id, id);
        }
      }
    }

    // If completed, mark all DAG nodes as complete + feedback loop
    if (data.status === "completed" && task) {
      const dag = this.rak.mesh.getDAG(id);
      for (const node of dag) {
        if (node.status === "pending" || node.status === "running") {
          this.rak.mesh.completeNode(node.id, id);
        }
      }

      // Feedback loop: update agent stats, write journal, create memory
      this.onTaskCompleted(task);
    }

    return task;
  }

  delete(id: string): boolean {
    return repo.deleteTask(id);
  }

  updateStep(taskId: string, stepId: string, data: Partial<TaskStep>): TaskStep | null {
    const step = repo.updateTaskStep(taskId, stepId, data);

    // Sync with RAK DAG
    if (step && data.status) {
      const dagNodeId = `${taskId}-${stepId}`;
      if (data.status === "running") this.rak.mesh.startNode(dagNodeId, taskId);
      if (data.status === "completed") this.rak.mesh.completeNode(dagNodeId, taskId);
      if (data.status === "failed") this.rak.mesh.failNode(dagNodeId, taskId, "Step failed");
    }

    return step;
  }

  private onTaskCompleted(task: Task): void {
    const agents = task.assignedAgents ?? [];
    const now = new Date().toISOString();

    for (const agentId of agents) {
      // Update agent stats
      try {
        const agent = agentRepo.getAgentById(agentId);
        if (agent) {
          const totalTasks = agent.taskCount + 1;
          const successRate = Math.round(((agent.successRate * agent.taskCount + 100) / totalTasks) * 10) / 10;
          agentRepo.updateAgentStats(agentId, { taskCount: totalTasks, successRate });
        }
      } catch { /* agent may not exist */ }

      // Write journal entry
      try {
        journalRepo.addEntry({
          agentId,
          type: "decision",
          content: `完成任务「${task.title}」`,
          context: { taskId: task.id, taskTitle: task.title },
        });
      } catch { /* non-critical */ }

      // Create auto-memory
      try {
        memoryRepo.createMemory({
          zone: "agent",
          title: `完成: ${task.title}`,
          content: task.description || `任务「${task.title}」已成功完成`,
          type: "script",
          tags: ["task-completion", task.id],
          agentId,
        });
      } catch { /* non-critical */ }

      // Emit event
      agentEventBus.emit(agentId, {
        type: "decision",
        agentId,
        data: { action: "task_completed", taskId: task.id, taskTitle: task.title },
        timestamp: now,
      });
    }
  }
}
